// @vitest-environment node
import {afterAll, beforeAll, expect, test} from "vitest";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import {createServer, type Server} from "node:https";
import {createSecureContext} from "node:tls";
import {probeResolvedTlsEndpoints,probeTlsEndpoint} from "./providerNode";
import {PROBE_BODY} from "./domainRules";
let folder: string;
let key: string;
let cert: string;
beforeAll(() => {
  folder = mkdtempSync(join(tmpdir(),"sites-synthetic-tls-"));
  execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-days","3","-subj","/CN=localhost","-addext","subjectAltName=DNS:localhost","-keyout",join(folder,"key.pem"),"-out",join(folder,"cert.pem")],{stdio:"ignore"});
  key = readFileSync(join(folder,"key.pem"),"utf8"); cert = readFileSync(join(folder,"cert.pem"),"utf8");
});
afterAll(() => {if (folder) rmSync(folder,{recursive:true,force:true});});
async function serve(handler: Parameters<typeof createServer>[1]) {
  const server = createServer({key,cert},handler);
  await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
  return {server,port:(server.address() as {port:number}).port};
}
async function close(server: Server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
test("local trusted chain and matching SNI, rejects untrusted and wrong hostname",async () => {
  const {server,port} = await serve((_req,res) => {res.writeHead(200,{"Content-Type":"text/plain; charset=utf-8"});res.end(PROBE_BODY);});
  try {
    await expect(probeTlsEndpoint("localhost","127.0.0.1",port,cert)).resolves.toMatchObject({deploymentProbeMatched:true});
    await expect(probeTlsEndpoint("localhost","127.0.0.1",port)).rejects.toThrow();
    await expect(probeTlsEndpoint("other.localhost","127.0.0.1",port,cert)).rejects.toThrow();
  } finally {await close(server);}
});
test("IPv6 pin accepts the same local socket under expanded spelling",async () => {
  const server = createServer({key,cert},(_req,res) => {res.writeHead(200,{"Content-Type":"text/plain; charset=utf-8"});res.end(PROBE_BODY);});
  await new Promise<void>(resolve => server.listen(0,"::1",resolve));
  try {
    await expect(probeTlsEndpoint("localhost","0:0:0:0:0:0:0:1",(server.address() as {port:number}).port,cert)).resolves.toMatchObject({deploymentProbeMatched:true});
  } finally {await close(server);}
});
test("rejects a near-expiry leaf even when chain and hostname validate",async () => {
  execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-days","1","-subj","/CN=localhost","-addext","subjectAltName=DNS:localhost","-keyout",join(folder,"short-key.pem"),"-out",join(folder,"short-cert.pem")],{stdio:"ignore"});
  const short = readFileSync(join(folder,"short-cert.pem"),"utf8");
  const server = createServer({key:readFileSync(join(folder,"short-key.pem"),"utf8"),cert:short},(_req,res) => {res.writeHead(200,{"Content-Type":"text/plain; charset=utf-8"});res.end(PROBE_BODY);});
  await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
  try {
    const port = (server.address() as {port:number}).port;
    await expect(probeTlsEndpoint("localhost","127.0.0.1",port,short)).rejects.toThrow("Invalid TLS certificate");
    await expect(probeResolvedTlsEndpoints(["8.8.8.8","1.1.1.1"], ip => ip === "8.8.8.8"
      ? Promise.resolve({leafFingerprintSha256:"a".repeat(64),leafNotAfter:Date.now()+172_800_000,deploymentProbeMatched:true as const})
      : probeTlsEndpoint("localhost","127.0.0.1",port,short))).rejects.toThrow("Invalid TLS certificate");
  } finally {await close(server);}
});
test("rejects a changed certificate between trusted handshake and HTTP probe",async () => {
  execFileSync("openssl",["req","-x509","-newkey","rsa:2048","-nodes","-days","3","-subj","/CN=localhost","-addext","subjectAltName=DNS:localhost","-keyout",join(folder,"other-key.pem"),"-out",join(folder,"other-cert.pem")],{stdio:"ignore"});
  const other = readFileSync(join(folder,"other-cert.pem"),"utf8");
  const otherKey = readFileSync(join(folder,"other-key.pem"),"utf8");
  let connections = 0;
  const server = createServer({key,cert,SNICallback:(_name,cb) => cb(null,createSecureContext({key:++connections === 1 ? key : otherKey,cert:connections === 1 ? cert : other}))},(_req,res) => {res.writeHead(200,{"Content-Type":"text/plain; charset=utf-8"});res.end(PROBE_BODY);});
  await new Promise<void>(resolve => server.listen(0,"127.0.0.1",resolve));
  try {
    await expect(probeTlsEndpoint("localhost","127.0.0.1",(server.address() as {port:number}).port,[cert,other].join("\n"))).rejects.toThrow("Probe connection mismatch");
    expect(connections).toBe(2); // Both handshakes used the hostname's SNI context.
  } finally {await close(server);}
});
test("rejects redirects, body overflow and marker mismatch",async () => {
  for (const [status,body,headers] of [[302,"",{location:"/other"}],[200,"x".repeat(129),{}],[200,"wrong",{}]] as const) {
    const {server,port} = await serve((_req,res) => {res.writeHead(status,{"Content-Type":"text/plain; charset=utf-8",...headers});res.end(body);});
    try {
      await expect(probeTlsEndpoint("localhost","127.0.0.1",port,cert)).rejects.toThrow();
      if (body === "wrong") {
        await expect(probeResolvedTlsEndpoints(["8.8.8.8","1.1.1.1"], ip => ip === "8.8.8.8"
          ? Promise.resolve({leafFingerprintSha256:"a".repeat(64),leafNotAfter:Date.now()+172_800_000,deploymentProbeMatched:true as const})
          : probeTlsEndpoint("localhost","127.0.0.1",port,cert))).rejects.toThrow("Wrong deployment marker");
      }
    } finally {await close(server);}
  }
});
test("total deadline stops a slow trickle even with active sockets",async () => {
  let timer: ReturnType<typeof setInterval>;
  const {server,port} = await serve((_req,res) => {res.writeHead(200,{"Content-Type":"text/plain; charset=utf-8"});timer = setInterval(() => res.write("x"),500);res.on("close",() => clearInterval(timer));});
  try {await expect(probeTlsEndpoint("localhost","127.0.0.1",port,cert)).rejects.toThrow("Probe total deadline");} finally {clearInterval(timer!);await close(server);}
},8000);
