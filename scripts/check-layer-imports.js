const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');

const forbiddenImportPatterns = [
  { pattern: /(^|\/)users\/user\.entity(\.ts)?$/, replacement: 'users/infrastructure/entities/user.entity' },
  { pattern: /(^|\/)users\/users\.service(\.ts)?$/, replacement: 'users/application/services/users.service' },
  { pattern: /(^|\/)roles\/roles\.decorator(\.ts)?$/, replacement: 'roles/presentation/decorators/roles.decorator' },
  { pattern: /(^|\/)roles\/roles\.guard(\.ts)?$/, replacement: 'roles/presentation/guards/roles.guard' },
  { pattern: /(^|\/)roles\/roles\.entity(\.ts)?$/, replacement: 'roles/infrastructure/entities/role.entity' },
  { pattern: /(^|\/)roles\/roles\.service(\.ts)?$/, replacement: 'roles/application/services/roles.service' },
  { pattern: /(^|\/)auth\/jwt-auth\.guard(\.ts)?$/, replacement: 'auth/presentation/guards/jwt-auth.guard' },
  { pattern: /(^|\/)auth\/auth\.service(\.ts)?$/, replacement: 'auth/application/services/auth.service' },
  { pattern: /(^|\/)auth\/auth\.controller(\.ts)?$/, replacement: 'auth/presentation/controllers/auth.controller' },
  { pattern: /(^|\/)auth\/jwt\.strategy(\.ts)?$/, replacement: 'auth/infrastructure/security/jwt.strategy' },
  { pattern: /(^|\/)auth\/public\.decorator(\.ts)?$/, replacement: 'auth/presentation/decorators/public.decorator' },
  { pattern: /(^|\/)auth\/email-otp\.entity(\.ts)?$/, replacement: 'auth/infrastructure/entities/email-otp.entity' },
  { pattern: /(^|\/)milestones\/milestone\.entity(\.ts)?$/, replacement: 'milestones/infrastructure/entities/milestone.entity' },
  { pattern: /(^|\/)milestones\/milestones\.service(\.ts)?$/, replacement: 'milestones/application/services/milestones.service' },
  { pattern: /(^|\/)reviews\/review\.entity(\.ts)?$/, replacement: 'reviews/infrastructure/entities/review.entity' },
  { pattern: /(^|\/)reviews\/reviews\.service(\.ts)?$/, replacement: 'reviews/application/services/reviews.service' },
  { pattern: /(^|\/)messages\/message\.entity(\.ts)?$/, replacement: 'messages/infrastructure/entities/message.entity' },
  { pattern: /(^|\/)messages\/messages\.service(\.ts)?$/, replacement: 'messages/application/services/messages.service' },
  { pattern: /(^|\/)projects\/project\.entity(\.ts)?$/, replacement: 'projects/infrastructure/entities/project.entity' },
  { pattern: /(^|\/)projects\/projects\.service(\.ts)?$/, replacement: 'projects/application/services/projects.service' },
  { pattern: /(^|\/)evidences\/evidence\.entity(\.ts)?$/, replacement: 'evidences/infrastructure/entities/evidence.entity' },
  { pattern: /(^|\/)evidences\/evidences\.service(\.ts)?$/, replacement: 'evidences/application/services/evidences.service' },
  { pattern: /(^|\/)assignments\/assignment\.entity(\.ts)?$/, replacement: 'assignments/infrastructure/entities/assignment.entity' },
  { pattern: /(^|\/)assignments\/assignments\.service(\.ts)?$/, replacement: 'assignments/application/services/assignments.service' },
  { pattern: /(^|\/)project-access\/project-access\.entity(\.ts)?$/, replacement: 'project-access/infrastructure/entities/project-access.entity' },
  { pattern: /(^|\/)project-access\/project-access\.service(\.ts)?$/, replacement: 'project-access/application/services/project-access.service' },
  { pattern: /(^|\/)admin\/admin\.service(\.ts)?$/, replacement: 'admin/application/services/admin.service' },
  { pattern: /(^|\/)config\/system-settings\.entity(\.ts)?$/, replacement: 'config/infrastructure/entities/system-settings.entity' },
  { pattern: /(^|\/)collaborative\/collaborative\.service(\.ts)?$/, replacement: 'collaborative/application/services/collaborative.service' },
  { pattern: /(^|\/)collaborative\/collaborative\.gateway(\.ts)?$/, replacement: 'collaborative/presentation/gateways/collaborative.gateway' },
];

const genericLegacyWrapperPattern =
  /(^|\/)(activity|admin|assignments|auth|collaborative|config|evidences|mail|messages|milestones|preview|project-access|projects|radar|reminders|reviews|roles|student|teacher|users|versions)\/([a-z0-9-]+\.(service|controller|entity|guard|decorator|gateway))(\.ts)?$/;
const legacyRootDtoPattern = /^(\.\.\/){2}dto\/.+\.dto(\.ts)?$/;
const applicationToPresentationPattern = /(^|\/)presentation\//;
const rootLegacyArtifactPattern =
  /^(activity|admin|assignments|auth|collaborative|config|evidences|mail|messages|milestones|preview|project-access|projects|radar|reminders|reviews|roles|student|teacher|users|versions)\/[^/]+\.(service|controller|entity|guard|decorator|gateway|dto)\.ts$/;

const importRegexes = [
  /\bimport\s+[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /\bexport\s+[\s\S]*?\sfrom\s*['"]([^'"]+)['"]/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function listFilesRecursive(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }

    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(absolutePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(absolutePath);
    }
  }

  return files;
}

function isLayeredFile(absolutePath) {
  const relative = path.relative(srcRoot, absolutePath).replace(/\\/g, '/');
  return /(^|\/)(application|presentation|infrastructure)\//.test(relative);
}

function extractImports(fileContent) {
  const imports = [];

  for (const regex of importRegexes) {
    regex.lastIndex = 0;
    let match = regex.exec(fileContent);
    while (match) {
      const specifier = (match[1] || '').replace(/\\/g, '/');
      imports.push({
        specifier,
        index: match.index,
      });
      match = regex.exec(fileContent);
    }
  }

  return imports;
}

function getLineNumber(fileContent, index) {
  return fileContent.slice(0, index).split(/\r?\n/).length;
}

function findForbiddenImport(specifier) {
  const explicit = forbiddenImportPatterns.find((rule) => rule.pattern.test(specifier));
  if (explicit) return explicit;

  const genericMatch = specifier.match(genericLegacyWrapperPattern);
  if (genericMatch) {
    const moduleName = genericMatch[2];
    const artifactName = genericMatch[3];
    return {
      pattern: genericLegacyWrapperPattern,
      replacement: `${moduleName}/(application|presentation|infrastructure)/... para ${artifactName}`,
    };
  }

  if (legacyRootDtoPattern.test(specifier)) {
    return {
      pattern: legacyRootDtoPattern,
      replacement: '.../(application|presentation)/dto/... (evitar src/<modulo>/dto wrappers)',
    };
  }

  return undefined;
}

function findAdditionalRule(specifier, filePath) {
  const relative = path.relative(srcRoot, filePath).replace(/\\/g, '/');
  if (/(^|\/)application\//.test(relative) && applicationToPresentationPattern.test(specifier)) {
    return {
      replacement: 'application/* no debe depender de presentation/* (mover DTO/contrato a application)',
    };
  }
  return undefined;
}

function main() {
  if (!fs.existsSync(srcRoot)) {
    console.error(`No se encontro carpeta src en: ${srcRoot}`);
    process.exit(1);
  }

  const allTsFiles = listFilesRecursive(srcRoot);
  const layeredFiles = allTsFiles.filter(isLayeredFile);
  const violations = [];

  for (const filePath of layeredFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = extractImports(content);

    for (const imported of imports) {
      const rule = findForbiddenImport(imported.specifier);
      const additionalRule = findAdditionalRule(imported.specifier, filePath);
      const finalRule = rule || additionalRule;
      if (!finalRule) continue;

      if (finalRule) {
        const line = getLineNumber(content, imported.index);
        const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
        violations.push({
          file: relativePath,
          line,
          specifier: imported.specifier,
          replacement: finalRule.replacement,
        });
      }
    }
  }

  for (const filePath of allTsFiles) {
    const relativePath = path.relative(srcRoot, filePath).replace(/\\/g, '/');
    if (!rootLegacyArtifactPattern.test(relativePath)) continue;
    if (relativePath.endsWith('.spec.ts')) continue;
    if (relativePath.endsWith('.module.ts')) continue;
    violations.push({
      file: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
      line: 1,
      specifier: relativePath,
      replacement: 'mover archivo a application|presentation|infrastructure',
    });
  }

  if (violations.length === 0) {
    console.log('check:layers OK - no se detectaron imports legacy en codigo por capas.');
    process.exit(0);
  }

  console.error('check:layers FAIL - imports legacy detectados:\n');
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line} -> "${violation.specifier}" (usar "${violation.replacement}")`,
    );
  }
  process.exit(1);
}

main();
