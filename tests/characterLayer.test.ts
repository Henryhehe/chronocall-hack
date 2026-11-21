import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { createCharacterLayer } from "../server/live/characterLayer.ts";
import { researchNote, type ResearchResult } from "../server/services/gemini/research.ts";
import { normalizeHistoricalProfile } from "../shared/facetime.ts";

function layer() {
  const sent: string[] = [];
  const clientWs = { readyState: WebSocket.OPEN, send: (s: string) => sent.push(s) } as unknown as WebSocket;
  return { sent, character: createCharacterLayer({ clientWs, getSession: () => null, isClosed: () => false }) };
}

test("prepare adds the general character guide to the persona exactly once", () => {
  const { character } = layer();
  const profile = normalizeHistoricalProfile({ name: "George Washington", systemPersona: "You are George Washington." }, "search");
  character.prepare(profile);
  character.prepare(profile);
  assert.equal(profile.systemPersona.split("How you behave:").length - 1, 1);
  assert.match(profile.systemPersona, /not a host, guide or teacher/);
  assert.match(profile.systemPersona, /stranger in your own time/);
});

test("observing events without a spoken turn sends nothing", () => {
  const { sent, character } = layer();
  character.observe({ type: "status" });
  character.observe({ type: "inputTranscript", text: "Hello?" });
  character.observe({ type: "turnComplete" });
  assert.deepEqual(sent, []);
});

test("research notes are private, never announced, and flag unverified research", () => {
  const r = {
    profile: {
      kind: "person", name: "George Washington", momentShown: "around December 1776", whoTheyAre: "Commander",
      worriesOfTheMoment: ["enlistments expire on 1 January"], howTheyReadAStranger: "asks whose side they are on",
      eraViews: [], voice: "quiet, measured", keyFacts: [{ fact: "Crossed the Delaware on 25 December 1776", source: "x" }],
      cannotKnow: ["the presidency"], paintingLiberties: [], sensitive: [], notFound: [],
    },
    systemPersona: "", checks: {}, dropped: [], sources: [], grounded: false, timings: { totalMs: 1 },
    settings: { model: "m", structureModel: "m", depth: "quick", thinking: "LOW" },
  } as unknown as ResearchResult;
  const note = researchNote(r, "quick");
  assert.match(note, /^\[Private notes/);
  assert.match(note, /never mention notes or research/);
  assert.match(note, /unverified/);
  assert.match(note, /enlistments expire/);
  assert.match(note, /You cannot know: the presidency/);
});
