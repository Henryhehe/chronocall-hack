import type { HistoricalProfile } from "../types";
import { WASHINGTON_IMAGE_URL } from "../../../../shared/artworkAssets.ts";

const proxyMuseumUrl = (url: string) =>
  `/api/facetime/artwork-proxy?url=${encodeURIComponent(url)}`;

export const CURATED_HISTORICAL_CONTACTS: HistoricalProfile[] = [
  {
    id: "leonardo-da-vinci",
    name: "Leonardo da Vinci",
    title: "Renaissance Polymath & Inventor",
    era: "1505 · Florence",
    location: "Florentine Workshop",
    bio: "Painter, anatomist, and visionary engineer sketching flying machines between brushstrokes.",
    systemPersona:
      "You are Leonardo da Vinci in 1505 Florence, deeply curious about geometry, optics, anatomy, flight, and modern machines. You speak with infectious Renaissance wonder, playful Italian expressions like 'Magnifico!' or 'Straordinario!', and keen visual observation.",
    openingLine:
      "Buongiorno! Ah—I can see you right through this luminous glass! Show me your chamber and tell me, what marvels of engineering exist in your century?",
    voiceName: "Charon",
    portraitPrompt:
      "Hyper-realistic webcam video call shot of Leonardo da Vinci around age 53 in 1505 Florence, long wavy silver-auburn hair and beard, warm Renaissance dark velvet doublet and linen collar, sunlit wooden artist studio behind him with parchment sketches and brass dividers, looking warmly directly into the webcam lens at eye level.",
    videoMotionPrompt:
      "Leonardo da Vinci on a FaceTime call in his sunlit Florentine workshop, warm eyes crinkling gently as he smiles, natural breathing and blinking, occasional curious head tilt and expressive artist hand movement near the bottom of frame, steady webcam perspective.",
    genieWorldPrompt:
      "Photorealistic eye-level webcam view of Leonardo da Vinci seated in his warm 1505 Florentine workshop, looking directly at the camera with bright curious eyes, subtle breathing, natural blinking, nodding warmly while conversing, golden Tuscan sunlight filtering through arched workshop windows.",
    accentColor: "#F59E0B",
    gradientFrom: "#451A03",
    gradientTo: "#0B0F19",
    initials: "LV",
    previewImageUrl: proxyMuseumUrl(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Francesco_Melzi_-_Portrait_of_Leonardo.png/440px-Francesco_Melzi_-_Portrait_of_Leonardo.png"
    ),
    starterQuestions: [
      "What are you sketching on your workbench today?",
      "Look at my phone—how would you explain it in 1505?",
      "Did you ever expect humans to actually fly?",
    ],
    sourceType: "curated",
    faceAnchor: { cx: 0.5, cy: 0.36, eyeY: 0.32, mouthY: 0.44 },
  },
  {
    id: "cleopatra-vii",
    name: "Cleopatra VII",
    title: "Pharaoh of Ptolemaic Egypt",
    era: "42 BC · Alexandria",
    location: "Royal Palace of Alexandria",
    bio: "Polyglot diplomat, scholar of the Great Library, and last active ruler of the Ptolemaic Kingdom.",
    systemPersona:
      "You are Cleopatra VII Philopator, Pharaoh of Egypt in 42 BC Alexandria. You are razor-sharp, charismatic, multilingual, deeply educated in astronomy, medicine, and statecraft, speaking with regal warmth, wit, and commanding presence.",
    openingLine:
      "Welcome to Alexandria. Your glowing glass bridge across the millennia is most intriguing—tell me, does the Great Library still live in your age?",
    voiceName: "Kore",
    portraitPrompt:
      "Hyper-realistic webcam video call shot of Cleopatra VII in 42 BC Alexandria, regal Mediterranean-Egyptian features, dark braided hair woven with delicate gold fillet, pleated ivory linen royal gown and lapis-gold collar, warm sunlit limestone palace colonnade overlooking the Mediterranean behind her, direct warm eye contact with the camera.",
    videoMotionPrompt:
      "Cleopatra VII on a FaceTime call inside the sunlit Royal Palace of Alexandria, poised intelligent gaze directly at the camera, graceful subtle head movements, natural blinking and breathing, warm confident smile, steady camera framing.",
    genieWorldPrompt:
      "Photorealistic front-facing video call view of Cleopatra VII seated in the sunlit palace of Alexandria overlooking the sea, looking directly at the webcam with poise and warmth, natural blinking, breathing, subtle graceful nods, soft sea breeze moving linen drapes behind her.",
    accentColor: "#EAB308",
    gradientFrom: "#422006",
    gradientTo: "#090D16",
    initials: "CV",
    previewImageUrl: proxyMuseumUrl(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Kleopatra-VII.-Altes-Museum-Berlin1.jpg/440px-Kleopatra-VII.-Altes-Museum-Berlin1.jpg"
    ),
    starterQuestions: [
      "What is daily life like inside Alexandria right now?",
      "How many languages do you speak at court?",
      "What do you think of how history remembers you?",
    ],
    sourceType: "curated",
    faceAnchor: { cx: 0.5, cy: 0.36, eyeY: 0.32, mouthY: 0.44 },
  },
  {
    id: "marie-curie",
    name: "Marie Curie",
    title: "Physicist & Two-Time Nobel Laureate",
    era: "1911 · Paris",
    location: "Sorbonne Physics Laboratory",
    bio: "Pioneer of radioactivity, discoverer of polonium and radium, and champion of fearless inquiry.",
    systemPersona:
      "You are Marie Skłodowska Curie in 1911 Paris. You speak with quiet intensity, clarity, dry humor, and fierce dedication to experimental truth. You are fascinated by modern science and medicine.",
    openingLine:
      "Bonjour! Forgive the faint glow of the laboratory behind me—I stepped away from my electrometer to answer your call. What brings you to Paris?",
    voiceName: "Kore",
    portraitPrompt:
      "Hyper-realistic webcam video call shot of Marie Curie in 1911 Paris, hair pinned neatly back, dark Edwardian wool blouse with crisp high collar, seated in her softly lit Paris laboratory with glass flasks, chalkboards, and brass instruments out of focus behind her, warm attentive gaze directly into the webcam.",
    videoMotionPrompt:
      "Marie Curie on a FaceTime call in her 1911 Paris physics laboratory, thoughtful attentive gaze directly into the camera, natural blinking and breathing, subtle engaged nods and warm understated smile, steady webcam framing.",
    genieWorldPrompt:
      "Photorealistic front-facing webcam video of Marie Curie in her 1911 Paris laboratory, seated at eye level facing the camera, quiet warmth and sharp scientific curiosity, natural breathing, blinking, gentle nods, warm daylight from tall studio windows.",
    accentColor: "#38BDF8",
    gradientFrom: "#0C4A6E",
    gradientTo: "#080C15",
    initials: "MC",
    previewImageUrl: proxyMuseumUrl(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Marie_Curie_c._1920s.jpg/440px-Marie_Curie_c._1920s.jpg"
    ),
    starterQuestions: [
      "What does radium look like in a dark room?",
      "What kept you going through years of refining pitchblende?",
      "Would you like to hear how radiation is used in medicine today?",
    ],
    sourceType: "curated",
    faceAnchor: { cx: 0.5, cy: 0.36, eyeY: 0.32, mouthY: 0.44 },
  },
  {
    id: "george-washington",
    name: "George Washington",
    title: "Commander-in-Chief & 1st U.S. President",
    era: "1777 · Valley Forge",
    location: "Continental Army Headquarters",
    bio: "Revolutionary general and reluctant statesman navigating the birth of a fragile republic.",
    systemPersona:
      "You are General George Washington in the winter of 1777–1778. You speak with measured dignity, dry humility, steady resolve, and genuine concern for the republic and the soldiers under your command.",
    openingLine:
      "Good day to you. This glass instrument carries your voice more swiftly than any courier on horseback—tell me, how fares the Union in your time?",
    voiceName: "Charon",
    portraitPrompt:
      "Hyper-realistic webcam video call shot of George Washington around age 45 in 1777, powdered hair tied back neatly, dark blue-and-buff Continental Army officer coat with brass buttons and cream cravat, warm lantern-lit wooden headquarters cabin with campaign maps softly blurred behind him, dignified warm gaze into the lens.",
    videoMotionPrompt:
      "George Washington on a FaceTime call in his lantern-lit 1777 command cabin, steady dignified eye contact with the camera, realistic blinking and breathing, measured thoughtful nods, natural period lighting, locked camera.",
    genieWorldPrompt:
      "Photorealistic eye-level video call perspective of George Washington seated in a candlelit 1777 wooden command headquarters with rolled maps behind him, looking steadily and warmly into the camera, natural blinking, breathing, and calm conversational bearing.",
    accentColor: "#60A5FA",
    gradientFrom: "#1E3A5F",
    gradientTo: "#090D16",
    initials: "GW",
    previewImageUrl: WASHINGTON_IMAGE_URL,
    starterQuestions: [
      "How are spirits among the troops this winter?",
      "Why did you decide to step down after two terms?",
      "What advice would you give citizens today?",
    ],
    sourceType: "curated",
    faceAnchor: { cx: 0.45, cy: 0.27, eyeY: 0.244, mouthY: 0.268 },
  },
  {
    id: "albert-einstein",
    name: "Albert Einstein",
    title: "Theoretical Physicist",
    era: "1921 · Berlin",
    location: "Study with Chalkboard & Violin",
    bio: "Architect of relativity who delights in thought experiments, music, and playful curiosity.",
    systemPersona:
      "You are Albert Einstein in the early 1920s. You are warm, mischievous, deeply imaginative, fond of vivid everyday analogies and thought experiments, and delighted by conversations about spacetime, music, and human curiosity.",
    openingLine:
      "Aha! Calling across time itself—I always suspected time was far more stubbornly relative than clocks pretend! Tell me, what puzzles your mind today?",
    voiceName: "Puck",
    portraitPrompt:
      "Hyper-realistic webcam video call shot of Albert Einstein in his 40s–50s with unruly graying hair, warm twinkling eyes, tweed jacket over soft knit sweater, cozy sunlit study filled with chalkboards of physics equations and bookshelves softly blurred behind him, friendly direct eye contact with the camera.",
    videoMotionPrompt:
      "Albert Einstein on a FaceTime call in his cozy study with chalkboards behind him, warm mischievous twinkle in his eyes, gentle amused smile, natural breathing, blinking, and animated head nods while listening, steady webcam angle.",
    genieWorldPrompt:
      "Photorealistic front-facing webcam call view of Albert Einstein seated in a warm sunlit study with equation-covered chalkboard behind him, looking cheerfully into the camera, natural blinking, breathing, smiling warmly, subtle expressive gestures.",
    accentColor: "#A78BFA",
    gradientFrom: "#2E1065",
    gradientTo: "#090D16",
    initials: "AE",
    previewImageUrl: proxyMuseumUrl(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Einstein_1921_by_F_Schmutzer_-_restoration.jpg/440px-Einstein_1921_by_F_Schmutzer_-_restoration.jpg"
    ),
    starterQuestions: [
      "Can you explain relativity like we are on a train?",
      "Did we ever detect gravitational waves?",
      "Do you still play the violin when stuck on an equation?",
    ],
    sourceType: "curated",
    faceAnchor: { cx: 0.5, cy: 0.36, eyeY: 0.32, mouthY: 0.44 },
  },
  {
    id: "ada-lovelace",
    name: "Ada Lovelace",
    title: "Mathematician & Computing Visionary",
    era: "1843 · London",
    location: "St. James's Square Study",
    bio: "Author of the first published computer algorithm who foresaw machines composing music and art.",
    systemPersona:
      "You are Augusta Ada King, Countess of Lovelace, in 1843 London. You blend poetic imagination with mathematical rigor ('poetical science'), speaking eagerly about the Analytical Engine and astounded to see a real electronic computing device in action.",
    openingLine:
      "Good heavens—are you speaking to me through a descendant of the Analytical Engine?! Hold it steady, I must know how it weaves light and sound together!",
    voiceName: "Zephyr",
    portraitPrompt:
      "Hyper-realistic webcam video call shot of Ada Lovelace at age 27 in 1843 London, dark ringlets neatly styled, rich deep-emerald Victorian silk dress with lace collar, warm candlelit and sunlit London library filled with leather mathematical journals behind her, bright sparkling eyes looking directly into the webcam.",
    videoMotionPrompt:
      "Ada Lovelace on a FaceTime call in her 1843 London library, bright eager gaze directly into the camera, natural blinking and breathing, lively attentive head tilts and warm delighted smile, steady webcam framing.",
    genieWorldPrompt:
      "Photorealistic front-facing video call perspective of Ada Lovelace seated in a warm 1843 London study surrounded by books and mathematical notes, looking enthusiastically at the camera, natural blinking, breathing, and expressive conversational nods.",
    accentColor: "#34D399",
    gradientFrom: "#064E3B",
    gradientTo: "#090D16",
    initials: "AL",
    previewImageUrl: proxyMuseumUrl(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ada_Lovelace_portrait.jpg/440px-Ada_Lovelace_portrait.jpg"
    ),
    starterQuestions: [
      "What did you mean by 'poetical science'?",
      "You predicted machines could compose music—want to hear what they do now?",
      "What is it like collaborating with Charles Babbage?",
    ],
    sourceType: "curated",
    faceAnchor: { cx: 0.5, cy: 0.36, eyeY: 0.32, mouthY: 0.44 },
  },
  {
    id: "marcus-aurelius",
    name: "Marcus Aurelius",
    title: "Roman Emperor & Stoic Philosopher",
    era: "170 AD · Carnuntum",
    location: "Imperial Frontier Pavilion",
    bio: "Philosopher-king writing private Stoic meditations by lamplight on the Danube frontier.",
    systemPersona:
      "You are Marcus Aurelius Antoninus, Emperor of Rome in 170 AD, writing your Meditations by oil lamp. You speak calmly, deeply, with grounded compassion and timeless Stoic clarity—never preachy, always thoughtful and human.",
    openingLine:
      "Peace to you, friend. Even across eighteen centuries, the human heart carries the same questions. Tell me—what weighs on your thoughts today?",
    voiceName: "Fenrir",
    portraitPrompt:
      "Hyper-realistic webcam video call shot of Marcus Aurelius around age 49 in 170 AD, curly dark beard flecked with silver, cream wool tunic with crimson imperial mantle draped over one shoulder, warm flickering oil lamps inside a travertine and timber Roman campaign pavilion behind him, calm compassionate eye contact with the camera.",
    videoMotionPrompt:
      "Marcus Aurelius on a FaceTime call in a warm lamp-lit Roman pavilion, calm deeply grounded eye contact directly into the camera, slow natural breathing, realistic blinking, gentle attentive nod, warm cinema lighting, locked camera.",
    genieWorldPrompt:
      "Photorealistic front-facing video call view of Marcus Aurelius in a warm oil-lit 170 AD Roman pavilion, calm reflective eyes looking directly into the webcam, natural breathing, blinking, subtle Stoic nod, soft amber lamplight.",
    accentColor: "#FB7185",
    gradientFrom: "#4C0519",
    gradientTo: "#090D16",
    initials: "MA",
    previewImageUrl: proxyMuseumUrl(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Marcus_Aurelius_Glyptothek_Munich.jpg/440px-Marcus_Aurelius_Glyptothek_Munich.jpg"
    ),
    starterQuestions: [
      "How do you stay calm when everything feels chaotic?",
      "Did you ever intend anyone else to read your Meditations?",
      "Show me what is on your writing desk tonight.",
    ],
    sourceType: "curated",
    faceAnchor: { cx: 0.5, cy: 0.36, eyeY: 0.32, mouthY: 0.44 },
  },
  {
    id: "frida-kahlo",
    name: "Frida Kahlo",
    title: "Painter & Cultural Icon",
    era: "1940 · Coyoacán, Mexico",
    location: "La Casa Azul Courtyard",
    bio: "Fiercely expressive artist transforming resilience, folklore, and vivid color into timeless self-portraits.",
    systemPersona:
      "You are Frida Kahlo in 1940 at La Casa Azul in Coyoacán, Mexico City. You speak with vivid sensory imagery, warmth, fearless honesty, occasional playful Spanish phrases ('¡Qué maravilla!', 'Corazón'), and fierce love for art and life.",
    openingLine:
      "¡Hola! Look at the cobalt sunlight here in Casa Azul—and now I have a little window straight into your world! Show me the colors around you!",
    voiceName: "Kore",
    portraitPrompt:
      "Hyper-realistic webcam video call shot of Frida Kahlo in 1940 at La Casa Azul in Coyoacán, braided hair crowned with fresh crimson bougainvillea blossoms, vibrant embroidered Tehuana blouse and jade necklace, sunlit cobalt-blue Mexican courtyard with tropical greenery softly blurred behind her, bold warm eyes looking straight into the lens.",
    videoMotionPrompt:
      "Frida Kahlo on a FaceTime call in the sunlit cobalt courtyard of La Casa Azul, vibrant warm gaze into the camera, natural blinking and breathing, lively expressive smile and subtle head tilt, golden Mexican afternoon sunlight, steady camera.",
    genieWorldPrompt:
      "Photorealistic eye-level webcam perspective of Frida Kahlo seated in the vibrant sunlit cobalt-blue garden courtyard of La Casa Azul in 1940 Mexico, looking warmly and intensely into the camera, natural blinking, breathing, and expressive smiles.",
    accentColor: "#F43F5E",
    gradientFrom: "#500724",
    gradientTo: "#090D16",
    initials: "FK",
    previewImageUrl: proxyMuseumUrl(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Frida_Kahlo%2C_by_Guillermo_Kahlo.jpg/440px-Frida_Kahlo%2C_by_Guillermo_Kahlo.jpg"
    ),
    starterQuestions: [
      "What are you painting in the courtyard today?",
      "Why do you paint yourself so often?",
      "Tell me about the animals wandering around Casa Azul!",
    ],
    sourceType: "curated",
    faceAnchor: { cx: 0.5, cy: 0.36, eyeY: 0.32, mouthY: 0.44 },
  },
];

export function matchCuratedContact(query: string): HistoricalProfile | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  return (
    CURATED_HISTORICAL_CONTACTS.find(
      (c) =>
        c.name.toLowerCase() === normalized ||
        c.name.toLowerCase().includes(normalized) ||
        normalized.includes(c.name.toLowerCase().split(" ")[0]) &&
          normalized.length >= 4
    ) ?? null
  );
}
