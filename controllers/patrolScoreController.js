import PatrolScore, { SCORE_PATROLS } from "../models/PatrolScore.js";
import httpError from "../utils/httpError.js";

const dateFilter = (query = {}) => {
  const range = {};
  if (query.year) {
    const year = Number(query.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2200) throw httpError(400, "Year filter is invalid");
    range.$gte = new Date(Date.UTC(year, 0, 1));
    range.$lte = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  }
  if (query.dateFrom) {
    const from = new Date(`${query.dateFrom}T00:00:00.000Z`);
    if (Number.isNaN(from.getTime())) throw httpError(400, "Start date is invalid");
    range.$gte = range.$gte && range.$gte > from ? range.$gte : from;
  }
  if (query.dateTo) {
    const to = new Date(`${query.dateTo}T23:59:59.999Z`);
    if (Number.isNaN(to.getTime())) throw httpError(400, "End date is invalid");
    range.$lte = range.$lte && range.$lte < to ? range.$lte : to;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) throw httpError(400, "Start date must be before end date");
  return Object.keys(range).length ? { date: range } : {};
};

export async function getPatrolScoreboard(req, res) {
  const filter = dateFilter(req.query);
  const [entries, totals, years] = await Promise.all([
    PatrolScore.find(filter).sort({ date: -1, createdAt: -1 }).limit(500),
    PatrolScore.aggregate([
      { $match: filter },
      { $group: { _id: "$patrol", score: { $sum: "$points" }, added: { $sum: { $cond: [{ $gt: ["$points", 0] }, "$points", 0] } }, deducted: { $sum: { $cond: [{ $lt: ["$points", 0] }, { $abs: "$points" }, 0] } }, entries: { $sum: 1 } } },
    ]),
    PatrolScore.aggregate([{ $group: { _id: { $year: "$date" } } }, { $sort: { _id: -1 } }]),
  ]);
  const totalsMap = new Map(totals.map((item) => [item._id, item]));
  const scoreboard = SCORE_PATROLS.map((patrol) => ({ patrol, score: totalsMap.get(patrol)?.score || 0, added: totalsMap.get(patrol)?.added || 0, deducted: totalsMap.get(patrol)?.deducted || 0, entries: totalsMap.get(patrol)?.entries || 0 }))
    .sort((a, b) => b.score - a.score || a.patrol.localeCompare(b.patrol))
    .map((item, index) => ({ ...item, rank: index + 1 }));
  res.json({ success: true, scoreboard, entries, years: years.map((item) => item._id), eligiblePatrols: SCORE_PATROLS });
}

export async function createPatrolScore(req, res) {
  const patrol = String(req.body.patrol || "").toUpperCase();
  const points = Number(req.body.points);
  const reason = String(req.body.reason || "").trim();
  const date = new Date(`${req.body.date}T00:00:00.000Z`);
  if (!SCORE_PATROLS.includes(patrol)) throw httpError(400, `Points can only be assigned to: ${SCORE_PATROLS.join(", ")}`);
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 10000) throw httpError(400, "Points must be a non-zero whole number up to 10,000");
  if (!reason) throw httpError(400, "A reason is required");
  if (Number.isNaN(date.getTime())) throw httpError(400, "A valid date is required");
  const entry = await PatrolScore.create({ patrol, points, reason, date, createdBy: req.user.sub });
  res.status(201).json({ success: true, entry });
}
