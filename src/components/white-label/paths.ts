export const WHITE_LABEL_PATH = "/settings/white-label";

export const WHITE_LABEL_REPORTS_PATH = `${WHITE_LABEL_PATH}?tab=reports`;

/** Full-screen client preview; without an id it previews the default sample report. */
export const whiteLabelPreviewPath = (reportId?: string | null) => `${WHITE_LABEL_PATH}/preview${reportId ? `/${reportId}` : ""}`;
