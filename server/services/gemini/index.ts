import * as vision from "./vision.ts";
import * as character from "./character.ts";
import * as world from "./world.ts";
import * as genie from "./genie.ts";
import type { AiServices } from "../types.ts";

export const geminiServices: AiServices = { ...vision, ...character, ...world, ...genie };
