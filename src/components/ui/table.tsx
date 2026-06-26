import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * NEYO Table — the Odoo-style list-view primitive (A.20 component library).
 * Calm, dense-but-readable rows, sticky header, hover highlight, dark mode.
 * Wrap in <TableContainer> for the rounded card + horizontal scroll on mobile.
 *
 * Usage:
 *   <TableContainer>
 *     <Table>
 *       <THead><TR><TH>Name</TH><TH align="right">Amount</TH></TR></THead>
 *       <TBody>
 *         <TR><TD>Achieng Mary</TD><TD align="right">KES 5,000</TD></TR>
 *       </TBody>
 *     </Table>
 *   </TableContainer>
 */
export function TableContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-navy-100 bg-white",
        "dark:border-navy-800 dark:bg-navy-900",
        className
      )}
      {...props}
    />
  );
}

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn("w-full border-collapse text-sm", className)} {...props} />
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-navy-100 bg-navy-50/60 dark:border-navy-800 dark:bg-navy-900/60",
        className
      )}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-y divide-navy-100 dark:divide-navy-800", className)}
      {...props}
    />
  );
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "transition-colors duration-200 ease-apple hover:bg-navy-50/50 dark:hover:bg-navy-800/40",
        className
      )}
      {...props}
    />
  );
}

type Align = "left" | "right" | "center";
const alignClass: Record<Align, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function TH({
  align = "left",
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-navy-400",
        alignClass[align],
        className
      )}
      {...props}
    />
  );
}

export function TD({
  align = "left",
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: Align }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-navy-700 dark:text-navy-200",
        alignClass[align],
        className
      )}
      {...props}
    />
  );
}
