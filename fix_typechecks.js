const fs = require('fs');

let service = fs.readFileSync('src/lib/services/activity.service.ts', 'utf8');
service = service.replace('import { UserSession } from "@/lib/core/session";', 'import { SessionUser } from "@/lib/core/session";');
service = service.replaceAll('user: UserSession', 'user: SessionUser');
service = service.replaceAll('tenantDb(user.tenantId)', 'tenantDb()'); // oops, tenantDb() has no arguments
fs.writeFileSync('src/lib/services/activity.service.ts', service);

let route = fs.readFileSync('src/app/api/timetable/activities/route.ts', 'utf8');
route = route.replace('import { requirePermission } from "@/lib/core/permissions";', '');
route = route.replace('import { requireUser } from "@/lib/core/session";', 'import { requirePermission } from "@/lib/core/session";');
route = route.replace('import { respond } from "@/lib/api/respond";', 'import { ok, fail } from "@/lib/api/respond";');
route = route.replace('const user = await requireUser();\n    requirePermission(user, "VIEW_TIMETABLE");', 'const user = await requirePermission("academics.view");');
route = route.replace('const user = await requireUser();\n    requirePermission(user, "MANAGE_TIMETABLE");', 'const user = await requirePermission("academics.manage");');
route = route.replaceAll('respond({ data: ', 'ok(');
route = route.replace('ok(categories })', 'ok(categories)');
route = route.replace('ok(category, message: "Activity category created" })', 'ok(category, 201)'); // simplified
route = route.replaceAll('respond({ error: { code: error.code, message: error.message }, status: statusMap[error.code] })', 'fail(error.code, error.message, statusMap[error.code] as any)');
route = route.replaceAll('respond({ error: { code: "INVALID", message: (error as any).errors[0].message }, status: 400 })', 'fail("INVALID", (error as any).errors[0].message, 400)');
route = route.replaceAll('respond({ error: { code: "SERVER_ERROR", message: "An unexpected error occurred" }, status: 500 })', 'fail("SERVER_ERROR", "An unexpected error occurred", 500)');
fs.writeFileSync('src/app/api/timetable/activities/route.ts', route);

let client = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');
// Fix argument of type 'string | null | undefined'
client = client.replace('getActivityStyle(slot?.activityCategoryColor, isBandW)', 'getActivityStyle(slot?.activityCategoryColor ?? null, isBandW)');
fs.writeFileSync('src/components/academics/academics-client.tsx', client);

