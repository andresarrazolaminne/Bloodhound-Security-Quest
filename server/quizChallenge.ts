import crypto from "node:crypto";

const TTL_MS = 15 * 60 * 1000;

function getSecret(): string {
  return (
    process.env.QUIZ_CHALLENGE_SECRET?.trim() ||
    process.env.ADMIN_API_TOKEN?.trim() ||
    "dev-quiz-challenge-secret-change-in-production"
  );
}

export type QuizChallengePayload = {
  campaignId: number;
  userId: number;
  segmentId: number;
  /** order[slot] = índice original de quizOptions en esa posición mostrada */
  order: number[];
  exp: number;
};

function sign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function mintQuizChallengeToken(payload: QuizChallengePayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyQuizChallengeToken(token: string): QuizChallengePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig || sign(body) !== sig) return null;
  try {
    const raw = Buffer.from(body, "base64url").toString("utf8");
    const p = JSON.parse(raw) as QuizChallengePayload;
    if (
      typeof p.campaignId !== "number" ||
      typeof p.userId !== "number" ||
      typeof p.segmentId !== "number" ||
      !Array.isArray(p.order) ||
      !p.order.every((x) => typeof x === "number" && Number.isInteger(x) && x >= 0) ||
      typeof p.exp !== "number"
    ) {
      return null;
    }
    if (Date.now() > p.exp) return null;
    return p;
  } catch {
    return null;
  }
}

export function quizChallengeExpiry(): number {
  return Date.now() + TTL_MS;
}

/** Fisher–Yates shuffle; copia del array de índices 0..n-1 */
export function shuffleOrder(length: number, rng: () => number = Math.random): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
