const fs = require('fs');
let code = fs.readFileSync('src/lib/services/finance.service.ts', 'utf8');

const oldBatchInvoiceStart = `    const students = await tenantDb().student.findMany({
      where: { classId: { in: classes.map((c) => c.id) }, status: "ACTIVE" },
      select: { id: true },
    });`;

const newBatchInvoiceStart = `    const students = await tenantDb().student.findMany({
      where: { classId: { in: classes.map((c) => c.id) }, status: "ACTIVE" },
      select: { id: true, guardians: { include: { guardian: true } } },
    });

    const isSiblingDiscountEnabled = (await db.platformSetting.findUnique({ where: { key: "enable_sibling_discount" } }))?.value === "true";
    let siblingMap = new Map();
    if (isSiblingDiscountEnabled) {
      // Build a map of primary guardian ID to count of active students
      const allActive = await tenantDb().student.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, guardians: { where: { isPrimary: true }, select: { guardianId: true } } }
      });
      allActive.forEach(s => {
        if (s.guardians[0]) {
          const gId = s.guardians[0].guardianId;
          siblingMap.set(gId, (siblingMap.get(gId) || 0) + 1);
        }
      });
    }`;

code = code.replace(oldBatchInvoiceStart, newBatchInvoiceStart);

const oldLoopStart = `    for (const st of students) {
      if (skip.has(st.id)) continue;`;

const newLoopStart = `    for (const st of students) {
      if (skip.has(st.id)) continue;
      
      let discountKes = 0;
      let notes = null;
      if (isSiblingDiscountEnabled && st.guardians[0]?.isPrimary) {
         const count = siblingMap.get(st.guardians[0].guardianId) || 1;
         if (count > 1) {
            // Apply a flat 10% discount for families with multiple kids for K.13
            discountKes = Math.round(total * 0.1);
            notes = \`Applied 10% Sibling Discount (\${count} siblings enrolled).\`;
         }
      }`;

code = code.replace(oldLoopStart, newLoopStart);

const oldInvoiceCreate = `      const inv = await tenantDb().invoice.create({
        data: {
          tenantId: user.tenantId, invoiceNo, studentId: st.id, structureId,
          description: \`\${structure.level} - \${structure.name}\`,
          year: structure.year, term: structure.term,
          totalKes: total, dueDate,
        },
      });`;

const newInvoiceCreate = `      const inv = await tenantDb().invoice.create({
        data: {
          tenantId: user.tenantId, invoiceNo, studentId: st.id, structureId,
          description: \`\${structure.level} - \${structure.name}\`,
          year: structure.year, term: structure.term,
          totalKes: total, discountKes, notes, dueDate,
        },
      });`;

code = code.replace(oldInvoiceCreate, newInvoiceCreate);

fs.writeFileSync('src/lib/services/finance.service.ts', code);
