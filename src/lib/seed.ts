import type { Database } from "better-sqlite3";
import bcrypt from "bcryptjs";

/**
 * Pilot seed data: ops account, demo caregiver, one elder profile
 * (entered by the sales/ops team per the MVP onboarding flow), a
 * pending invitation for walking the full invite → signup flow, and
 * the reviewed playbook content library.
 */
export function seed(db: Database) {
  const now = new Date().toISOString();

  // --- Accounts -----------------------------------------------------------
  const opsHash = bcrypt.hashSync("alongside-ops", 10);
  const cgHash = bcrypt.hashSync("alongside-demo", 10);

  const ops = db
    .prepare("INSERT INTO users (email, password_hash, name, role, onboarded_at) VALUES (?,?,?,?,?)")
    .run("ops@alongside.app", opsHash, "Alongside Ops", "ops", now);

  const siti = db
    .prepare("INSERT INTO users (email, password_hash, name, role, onboarded_at) VALUES (?,?,?,?,?)")
    .run("siti@example.com", cgHash, "Siti Rahmati", "caregiver", now);

  // --- Elder profile (entered by ops via internal tool) --------------------
  const elder = db
    .prepare(
      "INSERT INTO elders (name, age, photo_emoji, conditions, care_needs, routine, bio, created_by) VALUES (?,?,?,?,?,?,?,?)"
    )
    .run(
      "Ibu Lastri Wijaya",
      82,
      "🌺",
      JSON.stringify(["Mild dementia", "Hypertension", "Arthritis (knees)"]),
      "Needs help with bathing, medication schedule, and stairs. Can eat independently. Uses a cane indoors, wheelchair for longer outings.",
      "Wakes 5:30am for prayers. Breakfast 7am. Light garden walk 8am. Nap 1–3pm. Dinner 6:30pm, in bed by 9pm.",
      "Retired batik seller from Yogyakarta. Raised five children. Proud, warm, and sharp-witted on good days.",
      ops.lastInsertRowid as number
    );
  const elderId = elder.lastInsertRowid as number;

  db.prepare(
    `INSERT INTO elder_preferences
      (elder_id, favorite_foods, music, hobbies, routines, dislikes, calming_strategies, mobility_limits, communication_style, dietary_restrictions, updated_at, updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    elderId,
    "Bubur ayam, sweet tea (reduced sugar), steamed banana, gado-gado without peanuts on doctor's advice",
    "Keroncong classics, Ismail Marzuki, gamelan radio on Sunday mornings",
    "Folding batik, tending orchids, watching cooking shows, telling stories about the market",
    "Morning prayers are non-negotiable. Likes the radio on during breakfast.",
    "Being rushed, loud television, cold showers, being spoken about as if not present",
    "Hold her hand and speak slowly. Mention her orchids or her batik days. A warm ginger drink helps in the evening.",
    "Cannot climb stairs unassisted. Gets dizzy standing up quickly (orthostatic). Cane indoors.",
    "Speak Bahasa Indonesia or slow, simple English. Face her directly — slight hearing loss on the left.",
    "Low salt (hypertension). No peanuts (doctor's advice). Soft foods preferred in the evening.",
    now,
    ops.lastInsertRowid as number
  );

  db.prepare("INSERT INTO care_circle (elder_id, user_id) VALUES (?,?)").run(elderId, siti.lastInsertRowid as number);

  db.prepare(
    "INSERT INTO family_contacts (elder_id, name, relationship, channel, phone, is_digest_recipient) VALUES (?,?,?,?,?,?)"
  ).run(elderId, "Maya Santoso", "Daughter", "whatsapp", "+62 812 5550 1234", 1);
  db.prepare(
    "INSERT INTO family_contacts (elder_id, name, relationship, channel, phone, is_digest_recipient) VALUES (?,?,?,?,?,?)"
  ).run(elderId, "Budi Wijaya", "Son", "sms", "+62 811 5550 9876", 0);

  // A pending invitation so the full invite → signup → onboarding flow can be demoed
  db.prepare(
    "INSERT INTO invitations (token, elder_id, invitee_name, status, created_by) VALUES (?,?,?,?,?)"
  ).run("demo-invite-token", elderId, "Rina Kusuma", "pending", ops.lastInsertRowid as number);

  // --- Sample notes so today's digest has substance -------------------------
  const noteStmt = db.prepare(
    "INSERT INTO notes (elder_id, author_id, category, content, shareable) VALUES (?,?,?,?,?)"
  );
  noteStmt.run(elderId, siti.lastInsertRowid as number, "update", "Ate a full bowl of bubur ayam for breakfast and asked for seconds of tea. Good appetite today.", 1);
  noteStmt.run(elderId, siti.lastInsertRowid as number, "observation", "Spent 40 minutes with the orchids this morning. Named each one for me — very clear and happy.", 1);
  noteStmt.run(elderId, siti.lastInsertRowid as number, "question", "Left knee seemed stiffer than usual going down the front step. Worth mentioning to the doctor at Friday's visit?", 1);

  // --- Playbook library (reviewed seed content) ------------------------------
  const pb = db.prepare(
    `INSERT INTO playbooks (slug, title, category, summary, triggers, steps, contraindications, reviewed_by, version)
     VALUES (?,?,?,?,?,?,?,?,?)`
  );

  const playbooks: Array<{
    slug: string;
    title: string;
    category: string;
    summary: string;
    triggers: string[];
    steps: Array<{ title: string; detail: string; caution?: string }>;
    contraindications: Array<{ ifProfileHas: string; note: string }>;
  }> = [
    {
      slug: "sundowning",
      title: "Evening confusion (sundowning)",
      category: "Dementia care",
      summary: "Late-afternoon or evening restlessness, confusion, or agitation in a person with dementia.",
      triggers: ["sundown", "evening confus", "agitated at night", "restless", "confused at dusk", "pacing at night", "agitasi sore", "confused in the evening"],
      steps: [
        { title: "Lower the stimulation", detail: "Turn off or turn down the TV and bright overhead lights. Close curtains before it gets dark outside so the change is gradual." },
        { title: "Keep your voice low and slow", detail: "Speak in short, calm sentences. Don't correct or argue with confused statements — respond to the feeling behind them." },
        { title: "Redirect to a familiar comfort", detail: "Offer a favorite calm activity or topic from her profile — music she loves, a familiar object, a warm (not hot) drink.", caution: "Avoid caffeine and sugary drinks in the evening." },
        { title: "Check for hidden discomfort", detail: "Quietly check: does she need the toilet? Is she hungry, thirsty, too warm or cold? Any sign of pain? Discomfort often drives evening agitation." },
        { title: "Keep the routine visible", detail: "Follow the usual evening sequence in the usual order. Predictability is calming — narrate gently what comes next." },
        { title: "If agitation keeps rising", detail: "Give space, stay within sight, and stay safe. If she is a danger to herself or this happens most evenings, log it and raise it with the family and doctor." },
      ],
      contraindications: [
        { ifProfileHas: "diabet", note: "Skip sweet drinks as a soother — use a warm unsweetened drink instead." },
      ],
    },
    {
      slug: "post-fall",
      title: "After a fall (no obvious emergency)",
      category: "Mobility & safety",
      summary: "What to do in the minutes after an elder falls, before and after helping them up.",
      triggers: ["fell", "fall", "slipped", "on the floor", "jatuh", "tripped"],
      steps: [
        { title: "Don't rush to lift", detail: "Stay calm and keep them still for a moment. Ask where it hurts before any movement.", caution: "If there is severe pain, a visibly deformed limb, a head strike, or they can't move — do NOT move them. Call emergency services now." },
        { title: "Check head to toe", detail: "Look for bleeding, swelling, bruising. Ask them to gently move fingers, wrists, ankles. Watch the face for winces they won't mention." },
        { title: "Help them up in stages", detail: "Roll to their side, then to hands and knees, then bring a sturdy chair close. They push up to kneeling, place hands on the chair seat, and rise slowly with you steadying — never pulling by the arms." },
        { title: "Sit and observe for 20 minutes", detail: "Offer water. Watch for dizziness, drowsiness, nausea, or new confusion — these need a doctor the same day." },
        { title: "Watch closely for 24 hours", detail: "Especially after any head contact: worsening headache, vomiting, unusual sleepiness, or confusion means emergency care immediately." },
        { title: "Log it and tell the family", detail: "Record when, where, and how the fall happened and what you observed. Share it in today's digest — patterns across falls matter to the doctor." },
      ],
      contraindications: [
        { ifProfileHas: "blood thinner", note: "On blood thinners even a minor head bump needs a doctor's review the same day." },
        { ifProfileHas: "osteoporosis", note: "With osteoporosis, treat any hip, wrist, or back pain after a fall as a possible fracture — don't assist walking until checked." },
      ],
    },
    {
      slug: "medication-refusal",
      title: "Refusing medication",
      category: "Medication",
      summary: "A calm, respectful sequence for when an elder won't take a scheduled medicine.",
      triggers: ["refus+medic", "refus+pill", "refus+obat", "won't take", "wont take", "spit+pill", "spit+medic", "hide+pill", "hiding+medic", "tidak mau minum obat", "skip+pill", "skip+dose"],
      steps: [
        { title: "Don't force, don't argue", detail: "Forcing breaks trust and rarely works twice. Step back and keep the moment low-pressure." },
        { title: "Look for the reason", detail: "Ask gently: is it the taste? Trouble swallowing? Fear of side effects? A belief they're already 'done' with it? The fix depends on the reason." },
        { title: "Try again in 20 minutes, differently", detail: "Change the context: different room, after a favorite song, alongside a small snack if the medicine allows food. Same ask, softer moment." },
        { title: "Connect it to what they care about", detail: "Frame it around their own goals from their profile — 'this is what keeps your knees good for the garden' works better than 'the doctor said so.'" },
        { title: "Never hide medicine in food without approval", detail: "Crushing or hiding medication can be unsafe and must only happen if the doctor and family have explicitly approved it.", caution: "Some tablets are dangerous when crushed." },
        { title: "If a dose is missed", detail: "Never double the next dose. Log the missed dose, and if it's a critical medicine (heart, blood pressure, diabetes, seizure), contact the family/doctor today." },
      ],
      contraindications: [
        { ifProfileHas: "swallow", note: "Swallowing difficulty noted in profile — ask the pharmacist about liquid or dispersible forms instead of pushing tablets." },
      ],
    },
    {
      slug: "wandering",
      title: "Wandering & trying to leave",
      category: "Dementia care",
      summary: "When a person with dementia insists on 'going home' or tries to leave the house.",
      triggers: ["wander", "going home", "trying to leave", "walked out", "keluyuran", "keeps leaving", "wants to go home"],
      steps: [
        { title: "Don't block or grab", detail: "Physically stopping them escalates fear. Walk alongside instead and match their pace for the first moments." },
        { title: "Join their reality", detail: "'Going home' is usually a feeling — of missing safety or purpose — not a place. Say 'Tell me about home' rather than 'You are home.'" },
        { title: "Redirect mid-motion", detail: "Suggest doing something together on the way: 'Before we go, help me with the orchids / let's have tea first.' Motion + purpose redirects better than words alone." },
        { title: "Remove the cues", detail: "Keys, bags, and shoes by the door are triggers. Keep them out of sight. A curtain over the front door lowers exit attempts." },
        { title: "Make the day tiring in a good way", detail: "Wandering peaks with restlessness. Build in a real walk or physical activity in the morning so the energy has somewhere to go." },
        { title: "If they do get out", detail: "Stay calm, follow at a slight distance, and guide them back with a warm errand ('the tea is ready'). Log every incident and alert the family — repeated exits need a safety plan." },
      ],
      contraindications: [],
    },
    {
      slug: "swallowing-difficulty",
      title: "Coughing or choking risk at meals",
      category: "Meals & nutrition",
      summary: "Reducing choking and aspiration risk when an elder coughs at meals or pockets food.",
      triggers: ["choke", "choking", "coughs when eating", "coughing while eating", "trouble swallowing", "tersedak", "food in cheek", "pockets food"],
      steps: [
        { title: "Sit fully upright, stay upright after", detail: "90 degrees during the meal and for 30 minutes after. Never feed someone who is drowsy or lying back.", caution: "If they can't breathe, can't speak, or are turning blue — that's choking. Call for emergency help and act immediately." },
        { title: "Slow everything down", detail: "Small spoonfuls, one at a time, fully swallowed before the next. Put the spoon down between bites. No talking with food in the mouth." },
        { title: "Adjust textures", detail: "Soft, moist, uniform textures are safest. Avoid mixed textures (soup with loose bits), crumbly or sticky foods. Thicken thin liquids if coughing happens with drinks." },
        { title: "Watch for silent signs", detail: "A wet or gurgly voice after swallowing, watery eyes, or repeated throat clearing are warning signs even without visible choking." },
        { title: "Check the mouth after meals", detail: "Pocketed food in the cheek is a choking risk later. A gentle rinse or sip of water helps clear residue." },
        { title: "Escalate a pattern", detail: "Coughing at most meals is not normal aging — flag it to the family and doctor for a swallowing assessment. Log which foods trigger it." },
      ],
      contraindications: [],
    },
    {
      slug: "refusing-food",
      title: "Not eating / refusing meals",
      category: "Meals & nutrition",
      summary: "When appetite drops or meals are refused — finding the cause and keeping nutrition up.",
      triggers: ["not eating", "won't eat", "wont eat", "refus+food", "refus+eat", "refus+meal", "no appetite", "tidak mau makan", "skipping meals", "barely ate"],
      steps: [
        { title: "Rule out the physical first", detail: "Mouth pain, ill-fitting dentures, constipation, and new medication side effects are the most common hidden causes. Check the simple things before assuming mood." },
        { title: "Shrink the portions", detail: "A full plate can overwhelm. Offer small, frequent portions — half now, half later counts as a win." },
        { title: "Lead with favorites", detail: "Use their favorite foods from the profile as the anchor of the meal, respecting any dietary restrictions listed there." },
        { title: "Make it social and unhurried", detail: "Eat together when you can. Appetite follows company. Never rush a meal or hover over each bite." },
        { title: "Fortify quietly", detail: "Add calories to what they already accept — an egg into porridge, milk into soup — rather than adding new dishes." },
        { title: "Track and escalate weight loss", detail: "More than a few days of poor eating, or visible weight loss, needs the family and doctor informed. Log what was offered vs. eaten." },
      ],
      contraindications: [
        { ifProfileHas: "diabet", note: "Diabetes in profile — avoid using sweets to tempt appetite; fortify savory foods instead." },
        { ifProfileHas: "low salt", note: "Low-salt diet in profile — season with herbs, lime, and aromatics rather than salt to make food appealing." },
      ],
    },
    {
      slug: "uti-confusion",
      title: "Sudden new confusion (possible UTI or illness)",
      category: "Health changes",
      summary: "Confusion that appears over hours or days is a medical signal, not 'just aging.'",
      triggers: ["suddenly confused", "sudden confusion", "more confused than usual", "confused today", "delirium", "linglung", "acting strange today", "not herself today", "not himself today"],
      steps: [
        { title: "Compare to their normal", detail: "The key question: is this different from their usual baseline? Sudden change over hours or days = possible delirium, which is medical, not dementia progressing." },
        { title: "Check the quiet culprits", detail: "In elders, urinary tract infections, dehydration, constipation, and new medicines are the top causes of sudden confusion — often with no fever and no complaint of pain." },
        { title: "Push fluids gently", detail: "Offer small drinks often. Dehydration both causes and worsens confusion." },
        { title: "Contact the doctor today", detail: "Sudden confusion warrants a same-day medical call and usually a urine test. Don't wait a few days to see.", caution: "With fever, shaking chills, severe drowsiness, or rapid breathing — seek emergency care now." },
        { title: "Keep them safe and oriented", detail: "Good lighting, familiar voice, no arguments about what's real. Stay close — falls spike during confused episodes." },
        { title: "Write down the timeline", detail: "When it started, what changed (new medicine? less drinking? fewer bathroom trips?). This timeline is gold for the doctor." },
      ],
      contraindications: [],
    },
    {
      slug: "agitation-deescalation",
      title: "Agitation & anger de-escalation",
      category: "Dementia care",
      summary: "In-the-moment steps when an elder becomes angry, accusatory, or physically agitated.",
      triggers: ["angry", "yelling", "shouting", "hitting", "aggressive", "accusing", "marah", "screaming at me", "upset with me", "agitated"],
      steps: [
        { title: "Safety and space first", detail: "Step back out of arm's reach, keep your body language open and unhurried. Remove or quiet whatever is stimulating the room." },
        { title: "Don't defend, don't correct", detail: "Accusations ('you stole my purse') are fear speaking. Arguing the facts escalates. Respond to the emotion: 'That would upset me too. Let's look together.'" },
        { title: "One calm voice", detail: "If others are present, one person speaks. Low, slow, few words. Use their name and identify yourself." },
        { title: "Find the trigger", detail: "Pain, needing the toilet, hunger, overstimulation, or a task that felt like an order. Fix the trigger, not the behavior." },
        { title: "Offer a graceful exit", detail: "A change of scene ('let's get some air') or a familiar comfort from their profile lets the moment end without anyone losing face." },
        { title: "Afterwards: log and de-brief", detail: "Note what preceded the episode. Repeated aggression, or any aggression that risks injury, must be raised with the family and doctor — there may be a treatable cause.", caution: "If you or the elder are in physical danger, leave the room and call for help. Your safety matters too." },
      ],
      contraindications: [],
    },
  ];

  for (const p of playbooks) {
    pb.run(
      p.slug,
      p.title,
      p.category,
      p.summary,
      JSON.stringify(p.triggers),
      JSON.stringify(p.steps),
      JSON.stringify(p.contraindications),
      "Reviewed by Alongside clinical advisory panel · Pilot content v1",
      "1.0"
    );
  }

  // Baseline analytics event
  db.prepare("INSERT INTO events (user_id, name, props) VALUES (?,?,?)").run(
    null,
    "seed_completed",
    JSON.stringify({ playbooks: playbooks.length })
  );
}
