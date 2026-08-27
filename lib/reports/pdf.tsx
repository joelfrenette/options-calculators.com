// Import the NODE build explicitly. @react-pdf/renderer ships a browser build
// and a node build; only the node one exports renderToBuffer, and a plain-ESM
// or mis-guessed conditional resolve picks the browser one (proven: the bare
// specifier resolved browser under node ESM and renderToBuffer was undefined).
// This route runs server-side only, so pinning the node path is correct.
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer/lib/react-pdf.js"
import React from "react"
import { type ReportPayload, formatCell, reportStamp } from "./types"

/**
 * The report as a PDF buffer, via @react-pdf/renderer — pure JS, no headless
 * browser, so it builds and runs on Vercel serverless (the reason this engine
 * was chosen over Puppeteer). Layout mirrors the email: title block, exec
 * summary, then the full table. Long tables paginate automatically.
 */

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#12171A", fontFamily: "Helvetica" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  desc: { fontSize: 10, color: "#4A5058", marginBottom: 2 },
  stamp: { fontSize: 8, color: "#788683", marginBottom: 12 },
  h: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#788683", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  summary: { fontSize: 10, lineHeight: 1.5, marginBottom: 16 },
  table: { borderTopWidth: 1, borderColor: "#D2DAD6" },
  headRow: { flexDirection: "row", backgroundColor: "#0F766E" },
  headCell: { color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 8, padding: 5 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#E4E9E6" },
  rowAlt: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#E4E9E6", backgroundColor: "#F3F4F6" },
  cell: { padding: 5, fontSize: 8 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7, color: "#788683", textAlign: "center" },
})

function widths(payload: ReportPayload): number[] {
  // First (label) column wider; the rest share the remainder evenly.
  const n = payload.columns.length
  if (n <= 1) return [100]
  const first = 26
  const rest = (100 - first) / (n - 1)
  return payload.columns.map((_, i) => (i === 0 ? first : rest))
}

export async function buildReportPdf(payload: ReportPayload): Promise<Buffer> {
  const w = widths(payload)
  const doc = (
    <Document title={payload.title} author="Options-Calculators.com">
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{payload.title}</Text>
        <Text style={styles.desc}>{payload.description}</Text>
        <Text style={styles.stamp}>Generated {reportStamp(payload)}</Text>

        <Text style={styles.h}>Executive summary</Text>
        <Text style={styles.summary}>{payload.executiveSummary}</Text>

        <Text style={styles.h}>Results ({payload.rows.length})</Text>
        <View style={styles.table}>
          <View style={styles.headRow} fixed>
            {payload.columns.map((c, i) => (
              <Text
                key={c.key}
                style={[styles.headCell, { width: `${w[i]}%`, textAlign: i === 0 ? "left" : "right" }]}
              >
                {c.label}
              </Text>
            ))}
          </View>
          {payload.rows.map((row, r) => (
            <View key={r} style={r % 2 === 1 ? styles.rowAlt : styles.row} wrap={false}>
              {payload.columns.map((c, i) => (
                <Text
                  key={c.key}
                  style={[styles.cell, { width: `${w[i]}%`, textAlign: i === 0 ? "left" : "right" }]}
                >
                  {formatCell(row[c.key], c.format)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Options-Calculators.com · ${payload.title} · page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  )
  return await renderToBuffer(doc)
}
