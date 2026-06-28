const fs = require('fs');
let code = fs.readFileSync('src/components/messaging/message-button.tsx', 'utf8');

// Usually messaging input forms are absolute or sticky positioned inside a flex-1 container.
const oldInput = `<div className="mt-4 flex items-center gap-2 border-t border-navy-100 pt-4 dark:border-navy-800">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSend(); }}
              placeholder="Type a message..."
              disabled={sending}
              autoFocus
            />
            <Button size="icon" disabled={!text.trim() || sending} onClick={handleSend} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </div>`;

const newInput = `<div className="mt-4 flex items-center gap-2 border-t border-navy-100 pt-4 dark:border-navy-800 shrink-0 sticky bottom-0 bg-white dark:bg-navy-950 pb-2 z-10">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSend(); }}
              placeholder="Type a message..."
              disabled={sending}
              autoFocus
            />
            <Button size="icon" disabled={!text.trim() || sending} onClick={handleSend} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-pop">
              <Send className="h-4 w-4" />
            </Button>
          </div>`;

if (code.includes('border-t border-navy-100 pt-4')) {
  code = code.replace(oldInput, newInput);
  fs.writeFileSync('src/components/messaging/message-button.tsx', code);
}
