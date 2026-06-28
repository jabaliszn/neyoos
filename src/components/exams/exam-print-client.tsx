"use client";

import * as React from "react";
import { Loader2, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";

export function ExamPrintClient() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [printing, setPrinting] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    fetch("/api/academics/exams/print-roster").then(r => r.json()).then(j => {
      if (j.ok) setData(j.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4"><Loader2 className="h-4 w-4 animate-spin"/></div>;
  if (!data) return <p className="text-sm italic text-navy-500">No active exams found.</p>;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold">Bulk Print Exam Results</h3>
          <Button onClick={() => window.print()} className="rounded-full print:hidden bg-blue-600 hover:bg-blue-700 text-white shadow-pop">
            <Printer className="h-4 w-4 mr-2"/> Print Stream-Wise Report
          </Button>
        </div>

        <div className="print:block hidden bg-white">
          <h1 className="text-xl font-black text-center mb-4">{data.tenant.name} - Exam Performance Roster</h1>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-navy-50">
                <th className="border border-navy-200 p-2">Class</th>
                <th className="border border-navy-200 p-2">Student</th>
                <th className="border border-navy-200 p-2">Adm No</th>
                <th className="border border-navy-200 p-2">Average Mark</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((r: any, idx: number) => (
                <tr key={idx}>
                  <td className="border border-navy-200 p-2 font-bold">{r.className}</td>
                  <td className="border border-navy-200 p-2">{r.studentName}</td>
                  <td className="border border-navy-200 p-2 text-navy-500">{r.admNo}</td>
                  <td className="border border-navy-200 p-2 font-bold">{r.average}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-[10px] text-center text-navy-400">Printed on {new Date().toLocaleDateString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}
