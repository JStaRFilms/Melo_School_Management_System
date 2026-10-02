import { assetBytes } from "../../../../core/gateway";
export const dynamic = "force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {return assetBytes(request.headers,(await params).id);}
