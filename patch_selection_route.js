const fs = require('fs');
let code = fs.readFileSync('src/app/api/academics/subject-selection/route.ts', 'utf8');

if (!code.includes('export async function POST')) {
  code = code.replace(
    'import { getSelectionReport } from "@/lib/services/subject-selection.service";',
    'import { getSelectionReport, createSelectionPortal, listAllSelectionPortals, SelectionError } from "@/lib/services/subject-selection.service";\nimport { createSelectionPortalSchema } from "@/lib/validations/subject-selection";'
  );

  const getReplace = `export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission("academics.view");
    const portalId = req.nextUrl.searchParams.get("portalId");
    
    if (portalId) {
      const data = await getSelectionReport(user, portalId);
      return ok({ data });
    } else {
      const data = await listAllSelectionPortals(user);
      return ok({ data });
    }
  } catch (error) {
    return handleError(error);
  }
}`;

  code = code.replace(/export async function GET[\s\S]*?}\n}/, getReplace);

  const postAdd = `
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission("academics.manage");
    const body = await req.json();
    const data = createSelectionPortalSchema.parse(body);
    
    const portal = await createSelectionPortal(user, data);
    return ok({ data: portal }, 201);
  } catch (error) {
    if (error instanceof SelectionError) {
      const statusMap = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID: 400, CLOSED: 423, CONFLICT: 409 };
      return fail(error.code, error.message, statusMap[error.code as keyof typeof statusMap] as any);
    }
    if ((error as any).name === "ZodError") {
      return fail("INVALID", (error as any).errors[0].message, 400);
    }
    return handleError(error);
  }
}
`;
  code += postAdd;
  fs.writeFileSync('src/app/api/academics/subject-selection/route.ts', code);
}
