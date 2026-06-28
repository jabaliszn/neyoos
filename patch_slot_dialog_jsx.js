const fs = require('fs');
let code = fs.readFileSync('src/components/academics/academics-client.tsx', 'utf8');

const oldJSX = `<div className="mb-4 flex items-center justify-between border-b border-navy-50 pb-2">
          <h4 className="font-bold text-navy-950">Set Lesson Slot</h4>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="space-y-1"><Label>Subject</Label>
            <select value={subId} onChange={(e)=>setSubId(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm">
              <option value="">Unassigned (Free Period)</option>
              {subjects.map((s: any)=><option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>Teacher</Label>
            <select value={teacherId} onChange={(e)=>setStaffId(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm">
              <option value="">Unassigned</option>
              {staff.map((s: any)=><option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>Venue / Room</Label>
            <Input value={venue} onChange={(e)=>setVenue(e.target.value)} placeholder="e.g. 8 East, Science Lab, Hall" />
          </div>

          <div className="flex items-center gap-2 py-1.5 border-t border-b border-navy-50">
            <input
              type="checkbox"
              id="isCombined"
              checked={isCombined}
              onChange={(e) => setIsCombined(e.target.checked)}
              className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500"
            />
            <label htmlFor="isCombined" className="text-xs font-semibold text-navy-700 cursor-pointer select-none">
              Is Combined / Joint Lesson
            </label>
          </div>

          {isCombined && (
            <div className="space-y-1">
              <Label>Classes Joined</Label>
              <Input
                value={combinedDetails}
                onChange={(e) => setCombinedDetails(e.target.value)}
                placeholder="e.g. Form 2 East & West"
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>`;

const newJSX = `<div className="mb-4 flex items-center justify-between border-b border-navy-50 pb-2">
          <h4 className="font-bold text-navy-950">Set Slot</h4>
          <button onClick={onClose} className="rounded-full p-1 text-navy-400 hover:bg-navy-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "SUBJECT" ? "default" : "outline"}
              className="flex-1 rounded-full text-xs h-8"
              onClick={() => setMode("SUBJECT")}
            >Subject</Button>
            <Button
              type="button"
              variant={mode === "ACTIVITY" ? "default" : "outline"}
              className="flex-1 rounded-full text-xs h-8"
              onClick={() => setMode("ACTIVITY")}
            >Activity</Button>
          </div>

          {mode === "SUBJECT" ? (
            <div className="space-y-1"><Label>Subject</Label>
              <select value={subId} onChange={(e)=>setSubId(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm">
                <option value="">Unassigned (Free Period)</option>
                {subjects.map((s: any)=><option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-1"><Label>Activity Category</Label>
              <select value={actId} onChange={(e)=>setActId(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm">
                <option value="">Select Activity...</option>
                {activities.map((a: any)=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-1"><Label>Supervisor / Teacher</Label>
            <select value={teacherId} onChange={(e)=>setStaffId(e.target.value)} className="w-full h-10 rounded-full border border-navy-200 bg-white px-3 text-sm">
              <option value="">Unassigned</option>
              {staff.map((s: any)=><option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>
          <div className="space-y-1"><Label>Venue / Room</Label>
            <Input value={venue} onChange={(e)=>setVenue(e.target.value)} placeholder="e.g. 8 East, Science Lab, Hall" />
          </div>

          {mode === "SUBJECT" && (
            <>
              <div className="flex items-center gap-2 py-1.5 border-t border-b border-navy-50">
                <input
                  type="checkbox"
                  id="isCombined"
                  checked={isCombined}
                  onChange={(e) => setIsCombined(e.target.checked)}
                  className="h-4 w-4 rounded border-navy-300 text-green-600 focus:ring-green-500"
                />
                <label htmlFor="isCombined" className="text-xs font-semibold text-navy-700 cursor-pointer select-none">
                  Is Combined / Joint Lesson
                </label>
              </div>

              {isCombined && (
                <div className="space-y-1">
                  <Label>Classes Joined</Label>
                  <Input
                    value={combinedDetails}
                    onChange={(e) => setCombinedDetails(e.target.value)}
                    placeholder="e.g. Form 2 East & West"
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </>
          )}
        </div>`;

code = code.replace(oldJSX, newJSX);
fs.writeFileSync('src/components/academics/academics-client.tsx', code);
