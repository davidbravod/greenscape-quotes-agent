const BASE = "https://services.leadconnectorhq.com";

function ghlHeaders(contentType?: string) {
  return {
    Authorization: `Bearer ${process.env.GHL_KEY}`,
    Version: process.env.GHL_VERSION ?? "2023-02-21",
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

export type GHLOpportunity = {
  id: string;
  name: string;
  monetaryValue: number;
  status: string;
  pipelineId: string;
  pipelineStageId: string;
  contactId: string | null;
  contact: { id: string; name: string; email: string } | null;
};

export async function searchOpportunities(query: string): Promise<GHLOpportunity[]> {
  const params = new URLSearchParams({
    location_id: process.env.GHL_LOCATION_ID!,
    limit: "20",
  });
  if (query) params.set("q", query);

  const res = await fetch(`${BASE}/opportunities/search?${params}`, {
    headers: ghlHeaders("application/json"),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL opportunity search failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  return (data.opportunities ?? []) as GHLOpportunity[];
}

export async function updateOpportunityValue(
  opportunityId: string,
  monetaryValue: number,
): Promise<void> {
  const res = await fetch(`${BASE}/opportunities/${opportunityId}`, {
    method: "PUT",
    headers: ghlHeaders("application/json"),
    body: JSON.stringify({ monetaryValue }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL opportunity update failed ${res.status}: ${text}`);
  }
}

export async function getOpportunity(opportunityId: string): Promise<GHLOpportunity> {
  const res = await fetch(`${BASE}/opportunities/${opportunityId}`, {
    headers: ghlHeaders("application/json"),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL get opportunity failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  return (data.opportunity ?? data) as GHLOpportunity;
}

// Uploads a PDF to GHL's custom field upload endpoint, then sets the returned
// file object on the opportunity's file custom field (GHL_QUOTE_FIELD_ID).
export async function uploadQuotePDFToOpportunity(
  opportunityId: string,
  pdfBuffer: Buffer,
  filename: string,
): Promise<void> {
  const fieldId = process.env.GHL_QUOTE_FIELD_ID;
  const locationId = process.env.GHL_LOCATION_ID;
  if (!fieldId) throw new Error("GHL_QUOTE_FIELD_ID is not set");
  if (!locationId) throw new Error("GHL_LOCATION_ID is not set");

  // Step 1: upload file to the custom field upload endpoint
  const form = new FormData();
  const arrayBuffer = pdfBuffer.buffer.slice(
    pdfBuffer.byteOffset,
    pdfBuffer.byteOffset + pdfBuffer.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: "application/pdf" });
  form.append("id", fieldId);
  form.append("maxFiles", "1");
  form.append("file", blob, filename);

  const uploadRes = await fetch(
    `${BASE}/locations/${locationId}/customFields/upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GHL_KEY}`,
        Version: process.env.GHL_VERSION ?? "2023-02-21",
        Accept: "application/json",
      },
      body: form,
    },
  );

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`GHL custom field upload failed ${uploadRes.status}: ${text}`);
  }

  // Response shape: { uploadedFiles: { [filename]: url }, meta: [{ url, mimetype, size, originalname }] }
  const uploaded = await uploadRes.json();
  const fileMeta = uploaded.meta?.[0];
  const fileUrl: string | undefined =
    fileMeta?.url ?? (uploaded.uploadedFiles ? Object.values(uploaded.uploadedFiles)[0] as string : undefined);

  if (!fileUrl) {
    throw new Error(`GHL upload returned no URL. Response: ${JSON.stringify(uploaded)}`);
  }

  const fileValue = {
    url: fileUrl,
    meta: {
      mimetype: fileMeta?.mimetype ?? "application/pdf",
      name: fileMeta?.originalname ?? fileMeta?.name ?? filename,
      size: fileMeta?.size ?? pdfBuffer.byteLength,
    },
    deleted: false,
  };

  // Step 2: set the file value on the opportunity custom field
  const patchRes = await fetch(`${BASE}/opportunities/${opportunityId}`, {
    method: "PUT",
    headers: ghlHeaders("application/json"),
    body: JSON.stringify({
      customFields: [{ id: fieldId, field_value: [fileValue] }],
    }),
  });

  if (!patchRes.ok) {
    const text = await patchRes.text();
    throw new Error(`GHL opportunity custom field update failed ${patchRes.status}: ${text}`);
  }
}
