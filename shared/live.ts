export type LiveClientMessage =
  | { type: "audio" | "video"; data: string }
  | { type: "text"; text: string };

export type LiveServerEvent =
  | { type: "status"; status: "connecting" | "connected" | "closed"; model?: string }
  | { type: "audio"; data: string }
  | { type: "inputTranscript" | "outputTranscript" | "modelText"; text: string }
  | { type: "interrupted" | "turnComplete" }
  | { type: "error"; message: string }
  | { type: "highlightObjects"; args: { summary?: string; objects?: Array<{ label?: string; confidence?: number; ymin?: number; xmin?: number; ymax?: number; xmax?: number; detail?: string }> } }
  | { type: "steerWorld"; event: string };
