import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Use built-in Helvetica — no font registration needed, works offline
const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#000",
    paddingTop: 48,
    paddingBottom: 60,
    paddingHorizontal: 48,
  },
  // ── Header ───────────────────────────────────────────────────
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  wordmark: { fontSize: 18, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
  submark: { fontSize: 9, color: "#555", marginTop: 2 },
  rule: { borderBottomWidth: 1, borderBottomColor: "#000", marginVertical: 16 },
  thinRule: { borderBottomWidth: 0.5, borderBottomColor: "#ccc", marginVertical: 8 },
  // ── Meta ─────────────────────────────────────────────────────
  metaGrid: { flexDirection: "row", gap: 32, marginBottom: 20 },
  metaBlock: { flex: 1 },
  metaLabel: { fontSize: 7, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 },
  metaValue: { fontSize: 9 },
  // ── Section ──────────────────────────────────────────────────
  sectionTitle: { fontSize: 7, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, marginTop: 16 },
  scopeText: { lineHeight: 1.6, color: "#333" },
  // ── Table ────────────────────────────────────────────────────
  lineSection: { marginTop: 12 },
  lineSectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 4, paddingBottom: 4, borderBottomWidth: 0.5, borderBottomColor: "#000" },
  tableHeader: { flexDirection: "row", paddingBottom: 3, marginBottom: 2 },
  tableHeaderText: { fontSize: 7, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  colDesc: { flex: 1 },
  colQty: { width: 36, textAlign: "right" },
  colUnit: { width: 36, textAlign: "right" },
  colPrice: { width: 52, textAlign: "right" },
  colTotal: { width: 60, textAlign: "right" },
  // ── Totals ───────────────────────────────────────────────────
  totalsContainer: { marginTop: 16, alignItems: "flex-end" },
  totalsBox: { width: 200 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { color: "#555" },
  totalsValue: { textAlign: "right" },
  totalsBold: { fontFamily: "Helvetica-Bold" },
  // ── Notes / Terms ─────────────────────────────────────────────
  notesGrid: { flexDirection: "row", gap: 24, marginTop: 20 },
  notesBlock: { flex: 1 },
  notesText: { lineHeight: 1.5, color: "#444" },
  // ── Footer ───────────────────────────────────────────────────
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#aaa" },
});

function fmt(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type PdfQuote = {
  id: string;
  client_name: string | null;
  site_address: string | null;
  scope_narrative: string | null;
  notes: string | null;
  terms_md: string | null;
  subtotal: number | null;
  tax_rate: number | null;
  tax: number | null;
  total: number | null;
  created_at?: string;
  sections: Array<{
    title: string;
    items: Array<{
      description: string;
      quantity: number;
      unit: string;
      unit_price: number;
    }>;
  }>;
};

export function QuotePDF({ quote }: { quote: PdfQuote }) {
  const date = quote.created_at
    ? new Date(quote.created_at).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const subtotal = Number(quote.subtotal ?? 0);
  const tax = Number(quote.tax ?? 0);
  const total = Number(quote.total ?? 0);
  const taxRate = Number(quote.tax_rate ?? 0);

  return (
    <Document>
      <Page size="LETTER" style={S.page}>
        {/* Header */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.wordmark}>GREENSCAPE PRO</Text>
            <Text style={S.submark}>Phoenix, AZ</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 8, color: "#555" }}>Quote #{quote.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={{ fontSize: 8, color: "#555", marginTop: 2 }}>{date}</Text>
          </View>
        </View>
        <View style={S.rule} />

        {/* Client / site meta */}
        <View style={S.metaGrid}>
          <View style={S.metaBlock}>
            <Text style={S.metaLabel}>Client</Text>
            <Text style={S.metaValue}>{quote.client_name || "—"}</Text>
          </View>
          <View style={S.metaBlock}>
            <Text style={S.metaLabel}>Site address</Text>
            <Text style={S.metaValue}>{quote.site_address || "—"}</Text>
          </View>
          <View style={S.metaBlock}>
            <Text style={S.metaLabel}>Prepared by</Text>
            <Text style={S.metaValue}>Greenscape Pro</Text>
          </View>
        </View>

        {/* Scope */}
        {quote.scope_narrative ? (
          <View>
            <Text style={S.sectionTitle}>Scope of work</Text>
            <Text style={S.scopeText}>{quote.scope_narrative}</Text>
          </View>
        ) : null}

        <View style={S.thinRule} />

        {/* Line item sections */}
        {quote.sections.map((section, si) => (
          <View key={si} style={S.lineSection} wrap={false}>
            <Text style={S.lineSectionTitle}>{section.title}</Text>

            {/* Table header */}
            <View style={S.tableHeader}>
              <Text style={[S.tableHeaderText, S.colDesc]}>Description</Text>
              <Text style={[S.tableHeaderText, S.colQty]}>Qty</Text>
              <Text style={[S.tableHeaderText, S.colUnit]}>Unit</Text>
              <Text style={[S.tableHeaderText, S.colPrice]}>Unit price</Text>
              <Text style={[S.tableHeaderText, S.colTotal]}>Total</Text>
            </View>

            {section.items.map((item, ii) => (
              <View key={ii} style={S.tableRow}>
                <Text style={S.colDesc}>{item.description}</Text>
                <Text style={S.colQty}>{item.quantity}</Text>
                <Text style={S.colUnit}>{item.unit}</Text>
                <Text style={S.colPrice}>{fmt(item.unit_price)}</Text>
                <Text style={S.colTotal}>{fmt(item.quantity * item.unit_price)}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Totals */}
        <View style={S.totalsContainer}>
          <View style={S.totalsBox}>
            <View style={[S.thinRule, { marginTop: 12 }]} />
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>Subtotal</Text>
              <Text style={S.totalsValue}>{fmt(subtotal)}</Text>
            </View>
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>Tax ({(taxRate * 100).toFixed(2)}%)</Text>
              <Text style={S.totalsValue}>{fmt(tax)}</Text>
            </View>
            <View style={S.rule} />
            <View style={S.totalsRow}>
              <Text style={[S.totalsLabel, S.totalsBold]}>Total</Text>
              <Text style={[S.totalsValue, S.totalsBold]}>{fmt(total)}</Text>
            </View>
          </View>
        </View>

        {/* Notes + Terms */}
        {(quote.notes || quote.terms_md) ? (
          <View style={S.notesGrid}>
            {quote.notes ? (
              <View style={S.notesBlock}>
                <Text style={S.sectionTitle}>Notes</Text>
                <Text style={S.notesText}>{quote.notes}</Text>
              </View>
            ) : <View style={S.notesBlock} />}
            {quote.terms_md ? (
              <View style={S.notesBlock}>
                <Text style={S.sectionTitle}>Payment terms</Text>
                <Text style={S.notesText}>{quote.terms_md}</Text>
              </View>
            ) : <View style={S.notesBlock} />}
          </View>
        ) : null}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>GREENSCAPE PRO — Phoenix, AZ</Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
