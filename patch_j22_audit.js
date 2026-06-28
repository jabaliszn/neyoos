const fs = require('fs');
let code = fs.readFileSync('src/lib/services/digital-identity.service.ts', 'utf8');

const oldInitiate = `  return tDb.transferPassportRequest.create({
    data: {
      sourceTenantId: user.tenantId,
      destinationTenantId: input.destinationTenantId || null,
      destinationEmail: input.destinationEmail || null,
      studentId: input.studentId,
      studentName: \\\`\\\${snapshot.profile.firstName} \\\${snapshot.profile.lastName}\\\`,
      accessCode,
      expiresAt,
      status: "PENDING",
      includedModules: JSON.stringify(input.includedModules),
      consentBy: input.consentBy,
      payloadJson: JSON.stringify(snapshot),
    }
  });
}`;

const newInitiate = `  const request = await tDb.transferPassportRequest.create({
    data: {
      sourceTenantId: user.tenantId,
      destinationTenantId: input.destinationTenantId || null,
      destinationEmail: input.destinationEmail || null,
      studentId: input.studentId,
      studentName: \`\${snapshot.profile.firstName} \${snapshot.profile.lastName}\`,
      accessCode,
      expiresAt,
      status: "PENDING",
      includedModules: JSON.stringify(input.includedModules),
      consentBy: input.consentBy,
      payloadJson: JSON.stringify(snapshot),
    }
  });

  // J.22 Compliance Audit Log (Data Protection Act / ODPC requirement)
  await db.auditLog.create({
    data: {
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.fullName,
      action: "compliance.transfer_passport_generated",
      entityType: "TransferPassportRequest",
      entityId: request.id,
      metadata: JSON.stringify({
        studentId: input.studentId,
        destination: input.destinationEmail || input.destinationTenantId || "Unknown",
        consentBy: input.consentBy,
        includedModules: input.includedModules,
        hasMedical: input.includedModules.includes("MEDICAL"),
        hasDiscipline: input.includedModules.includes("DISCIPLINE"),
      })
    }
  });

  return request;
}`;

code = code.replace(oldInitiate, newInitiate);

// Ensure db import is present if not already
if (!code.includes('import { db }')) {
  code = 'import { db } from "@/lib/db";\n' + code;
}

fs.writeFileSync('src/lib/services/digital-identity.service.ts', code);
