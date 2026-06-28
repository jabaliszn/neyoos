const fs = require('fs');
let code = fs.readFileSync('src/components/students/student-profile-client.tsx', 'utf8');

// Find the photo upload button area:
const oldPhotoSection = `          <FileUpload
            label=""
            value={s.photoUrl}
            onChange={(url) => { if (url) { const updated = { ...s, photoUrl: url }; setS(updated); mutate(updated, "Photo updated"); } }}
            className="w-full text-center"
            bucket="images"
          />`;

const newPhotoSection = `          {canEdit ? (
            <FileUpload
              label=""
              value={s.photoUrl}
              onChange={(url) => { if (url) { const updated = { ...s, photoUrl: url }; setS(updated); mutate(updated, "Photo updated"); } }}
              className="w-full text-center"
              bucket="images"
            />
          ) : (
            <div className="mt-2">
              <Button size="sm" variant="outline" className="w-full text-[10px]" onClick={async () => {
                // In a real app we'd prompt for the file first, here we simulate an approval request
                const dummyFileUrl = "https://example.com/new-photo.jpg";
                const res = await fetch("/api/students/approvals", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ studentId: s.id, requestType: "PHOTO_UPDATE", fileUrl: dummyFileUrl })
                });
                if (res.ok) toast({ title: "Photo update submitted for approval", tone: "success" });
                else toast({ title: "Failed to submit photo update", tone: "error" });
              }}>Request Photo Update</Button>
            </div>
          )}`;

code = code.replace(oldPhotoSection, newPhotoSection);

fs.writeFileSync('src/components/students/student-profile-client.tsx', code);
