import { existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const projectRoot = process.cwd();
const convexDir = join(projectRoot, 'packages', 'convex');
const generatedDir = join(convexDir, '_generated');

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

function checkFile(path: string, description: string): CheckResult {
  const exists = existsSync(path);
  return {
    name: description,
    passed: exists,
    message: exists ? '✅ Found' : '❌ Missing',
  };
}

function checkDirectory(path: string, description: string): CheckResult {
  const exists = existsSync(path);
  return {
    name: description,
    passed: exists,
    message: exists ? '✅ Found' : '❌ Missing',
  };
}

function main() {
  console.log('🔍 Convex Setup Verification');
  console.log('============================\n');

  const deploymentConfigured = Boolean(process.env.CONVEX_DEPLOYMENT);

  const checks: CheckResult[] = [
    // Configuration files
    checkFile(join(projectRoot, 'convex.json'), 'convex.json configuration'),
    checkFile(join(convexDir, 'package.json'), 'packages/convex/package.json'),
    checkFile(join(convexDir, 'schema.ts'), 'packages/convex/schema.ts'),
    checkFile(join(convexDir, 'convex.config.ts'), 'packages/convex/convex.config.ts'),
    checkFile(join(convexDir, 'http.ts'), 'packages/convex/http.ts'),
    checkFile(join(convexDir, 'betterAuth.ts'), 'packages/convex/betterAuth.ts'),
    
    // Generated files
    checkDirectory(generatedDir, 'packages/convex/_generated directory'),
    checkFile(join(generatedDir, 'api.ts'), 'packages/convex/_generated/api.ts'),
    checkFile(join(generatedDir, 'dataModel.ts'), 'packages/convex/_generated/dataModel.ts'),
    checkFile(join(generatedDir, 'server.ts'), 'packages/convex/_generated/server.ts'),
    
    // Environment files
    checkFile(join(projectRoot, 'apps', 'teacher', '.env.example'), 'apps/teacher/.env.example'),
    checkFile(join(projectRoot, 'apps', 'admin', '.env.example'), 'apps/admin/.env.example'),
    
    // Documentation
    checkFile(join(convexDir, 'README.md'), 'packages/convex/README.md'),
    checkFile(join(projectRoot, 'scripts', 'setup-convex.ps1'), 'scripts/setup-convex.ps1'),
    checkFile(join(projectRoot, 'scripts', 'setup-convex.sh'), 'scripts/setup-convex.sh'),
    {
      name: 'CONVEX_DEPLOYMENT environment variable',
      passed: deploymentConfigured,
      message: deploymentConfigured ? '✅ Found' : '❌ Missing',
    },
  ];

  let passed = 0;
  let failed = 0;

  checks.forEach((check) => {
    console.log(`${check.message} - ${check.name}`);
    if (check.passed) {
      passed++;
    } else {
      failed++;
    }
  });

  console.log('\n📊 Summary');
  console.log('===========');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${checks.length}`);

  if (failed === 0) {
    console.log('\n🧪 Running Convex codegen smoke test...');

    const codegen = spawnSync(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['convex:codegen'],
      {
        cwd: projectRoot,
        stdio: 'inherit',
        env: process.env,
      }
    );

    if (codegen.status !== 0) {
      console.log('\n❌ Convex codegen failed. Setup is not complete.');
      process.exit(codegen.status ?? 1);
    }

    console.log('\n✨ All checks passed! Convex setup is complete.');
    console.log('\n📝 Next steps:');
    console.log('1. Run: pnpm setup:convex');
    console.log('2. Update .env.local files with your Convex URL');
    console.log('3. Run: pnpm dev');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some checks failed. Please review the missing files.');
    console.log('A real Convex deployment must be selected before codegen can succeed.');
    process.exit(1);
  }
}

main();
