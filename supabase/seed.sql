-- ============================================================================
-- ১ দিনের সস্তায় ট্যুর — Initial Seed Data & Storage Policies
-- ============================================================================
-- IMPORTANT BEFORE RUNNING IN PRODUCTION SUPABASE:
-- 1. Replace the placeholder DIU Student IDs below with the 6 actual DIU IDs
--    in order: Mahadi, Shahriar, Seam, Ashik, Safin, Shoaib.
-- 2. Replace 'CHANGE_THIS_SHAHRIAR_ADMIN_PASSWORD' with Shahriar's strong password.
-- 3. Student IDs are hashed with SHA-256 and never stored in plaintext.
-- ============================================================================

INSERT INTO public.tour_settings (
  id, website_name_bn, website_name_en, tagline_bn, tagline_en,
  tour_date, start_location_bn, start_location_en,
  destinations_bn, destinations_en,
  estimated_budget_per_person, target_contribution_per_person,
  announcement_bn, announcement_en
)
VALUES (
  1,
  '১ দিনের সস্তায় ট্যুর',
  'Ek Diner Sostay Tour',
  'প্ল্যান ক্যানসেল না হইলেই হয়।',
  'As long as the plan doesn''t get cancelled.',
  '2026-11-28T06:30:00+06:00',
  'সিঅ্যান্ডবি, সাভার',
  'C&B, Savar',
  'পানাম নগর, সোনারগাঁও এবং সন্ধ্যায় পুরান ঢাকা',
  'Panam Nagar, Sonargaon & Puran Dhaka in the evening',
  1000.00,
  1000.00,
  '২৮ নভেম্বর ২০২৬ (শনিবার) সকাল ৬:৩০ মিনিটে সিঅ্যান্ডবি, সাভারে সবার উপস্থিতি নিশ্চিত করতে হবে। নগদ টাকা সাথে আনুন।',
  'Report at C&B, Savar by 6:30 AM on Saturday, 28 Nov 2026. Bring cash for group fund & meals.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tour_progress (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Insert the 6 Crew Members
WITH inserted_members AS (
  INSERT INTO public.members (slug, name_en, name_bn, nickname_en, nickname_bn, role, bio_en, bio_bn, badge_title_en, badge_title_bn, sort_order)
  VALUES
    ('mahadi', 'Mahadi', 'মাহাদি', 'Mahadi', 'মাহাদি ভাই', 'member', 'Always ready with the tea spot suggestions and morning hype.', 'সকালবেলা চা-নাস্তার স্পট আর আড্ডার মূল কারিগর।', 'Morning Navigator', 'সকালের পথপ্রদর্শক', 1),
    ('shahriar', 'Shahriar', 'শাহরিয়ার', 'Shahriar (Treasurer)', 'শাহরিয়ার (ট্রেজারার)', 'admin', 'Keeper of the cash pouch, receipts, and strict accounting.', 'ক্যাশ ব্যাগ, রসিদ আর একদম নিখুঁত হিসাবের দায়িত্বপ্রাপ্ত।', 'Iron Treasurer', 'হিসাবরক্ষক', 2),
    ('seam', 'Seam', 'সিয়াম', 'Seam', 'সিয়াম', 'member', 'Photographer eye & Panam Nagar heritage frame hunter.', 'পানাম নগরের ফ্রেম আর গ্রুপের আসল ফটোগ্রাফার।', 'Frame Hunter', 'ফ্রেম হান্টার', 3),
    ('ashik', 'Ashik', 'আশিক', 'Ashik', 'আশিক', 'member', 'Keeps the banter alive on long bus rides.', 'বাসের লম্বা যাত্রায় হাসি-ঠাট্টা জমিয়ে রাখার ওস্তাদ।', 'Vibe Captain', 'আড্ডার ক্যাপ্টেন', 4),
    ('safin', 'Safin', 'সাফিন', 'Safin', 'সাফিন', 'member', 'Puran Dhaka biriyani & street food connoisseur.', 'পুরান ঢাকার বিরিয়ানি ও স্ট্রিট ফুডের আসল সমঝদার।', 'Food Scout', 'ফুড স্কাউট', 5),
    ('shoaib', 'Shoaib', 'শোয়াইব', 'Shoaib', 'শোয়াইব', 'member', 'Deadline reminder & backup logistics coordinator.', 'সময়ের হিসাব আর ব্যাকআপ প্ল্যানের নির্ভরযোগ্য সঙ্গী।', 'Time Keeper', 'সময়ের প্রহরী', 6)
  ON CONFLICT (slug) DO UPDATE SET name_en = EXCLUDED.name_en
  RETURNING id, slug
)
-- Hash the 6 DIU Student IDs (SHA-256 hex hashes — no plaintext IDs stored)
INSERT INTO public.member_credentials (member_id, student_id_hash)
SELECT id,
  CASE slug
    WHEN 'mahadi'   THEN '14e55f7f6679a685abde05220969be8d6f384a9a813b7d9f6334cfbf02f3f82b'
    WHEN 'shahriar' THEN 'eae102e7d6d2eb31e20ef3a8f0d8489f2d772f49632eb8bcc3b8427726726fa'
    WHEN 'seam'     THEN '3fe1e31c3827f81fd99b6e5c428494d683abbccce6941a2b2544ab266c0f73d9'
    WHEN 'ashik'    THEN '22deb4a93613035405e24b8d6201f35a7eddf71007093f8f74788a77eb3c50ac'
    WHEN 'safin'    THEN '9864275f74de5e46a989b217338458c744a4b9ef0d9b7a65a7aa4a1d4d323e14'
    WHEN 'shoaib'   THEN '0bf8a8c59070defd4263129863a6a575331dc5c882e6d8783ae791df79fcf8e8'
  END
FROM inserted_members
ON CONFLICT (member_id) DO UPDATE SET student_id_hash = EXCLUDED.student_id_hash;

-- Set Shahriar's Admin Password (REPLACE PASSWORD BEFORE RUNNING)
INSERT INTO public.admin_credentials (member_id, password_hash)
SELECT id, crypt('CHANGE_THIS_SHAHRIAR_ADMIN_PASSWORD', gen_salt('bf'))
FROM public.members
WHERE slug = 'shahriar'
ON CONFLICT (member_id) DO NOTHING;

-- Seed Initial Itinerary (Savar C&B -> Sonargaon Panam Nagar -> Puran Dhaka -> Savar)
INSERT INTO public.itinerary_items (
  sort_order, time_label, duration_label, title_bn, title_en, location_bn, location_en,
  activity_bn, activity_en, transport_bn, transport_en, estimated_cost, notes_bn, notes_en, lat, lng, segment_type
)
VALUES
  (1, '06:30 AM', '30 min', 'সবার জমায়েত ও সকালের চা', 'Crew Assembly & Morning Tea', 'সিঅ্যান্ডবি বাস স্ট্যান্ড, সাভার', 'C&B Bus Stand, Savar', '৬ জনের উপস্থিতি নিশ্চিত করা, নগদ টাকা জমা নেওয়া এবং হালকা চা-বিস্কুট।', 'Confirm all 6 members, collect cash fund, and grab quick morning tea.', 'পায়ে হাঁটা', 'On Foot', 30, 'সবাই ৬:২০-এর মধ্যে চলে আসবে।', 'Everyone arrives by 6:20 AM sharp.', 23.8482, 90.2644, 'departure'),
  (2, '07:00 AM', '1h 15m', 'সাভার থেকে গুলিস্তান যাত্রা', 'Savar to Gulistan Transit', 'সাভার → গুলিস্তান', 'Savar → Gulistan', 'ভোরের ফাঁকা রাস্তায় বাসে করে ঢাকা প্রবেশ।', 'Morning bus ride into Dhaka before peak traffic.', 'লোকাল/সিটিং বাস', 'Local / Sitting Bus', 60, 'টিকিট/ভাড়া একসাথে দেওয়া হবে।', 'Group bus fare paid from cash pouch.', 23.7249, 90.4125, 'transit'),
  (3, '08:30 AM', '1h 15m', 'গুলিস্তান থেকে মোগড়াপাড়া/সোনারগাঁও', 'Gulistan to Sonargaon (Mograpara)', 'গুলিস্তান → মোগড়াপাড়া চৌরাস্তা', 'Gulistan → Mograpara Crossing', 'দোয়েল/বোরাক এসি বা নন-এসি বাসে ঢাকা-চট্টগ্রাম মহাসড়ক ধরে যাত্রা ও সকালের নাস্তা।', 'Bus via Dhaka-Chattogram highway + quick breakfast stop.', 'বাস + অটো', 'Bus + Auto', 110, 'মোগড়াপাড়া নেমে অটো রিজার্ভ করে সোনারগাঁও।', 'Take shared auto-rickshaw from Mograpara.', 23.6356, 90.6020, 'transit'),
  (4, '10:00 AM', '2h 00m', 'পানাম নগর ভ্রমণ ও ফটোসেশন', 'Panam Nagar Heritage Walk', 'পানাম নগর, সোনারগাঁও', 'Panam Nagar, Sonargaon', 'শতবর্ষী ঐতিহাসিক ভবন ঘুরে দেখা, গ্রুপ ছবি ও ভিডিও শুট।', 'Explore the century-old merchant street, group portraits & reels.', 'পায়ে হাঁটা', 'Walking Tour', 30, 'টিকিট প্রতিজন ~৳২০-৩০। রোদের জন্য ক্যাপ সাথে রাখুন।', 'Entry ticket ~৳20–30/person. Bring caps & water.', 23.6458, 90.6012, 'destination'),
  (5, '12:00 PM', '1h 30m', 'লোকশিল্প জাদুঘর ও গোয়ালদী মসজিদ', 'Folk Arts Museum & Goaldi Mosque', 'সোনারগাঁও জাদুঘর এলাকা', 'Sonargaon Museum Complex', 'বাংলাদেশ লোক ও কারুশিল্প ফাউন্ডেশন, লেকপাড় ও সুলতানি আমলের গোয়ালদী মসজিদ দর্শন।', 'Visit Folk Arts & Crafts Museum, lakeside, and historic Goaldi Mosque.', 'অটো / হাঁটা', 'Auto / Walk', 50, 'জাদুঘর টিকিট ও জুতা রাখার খরচ।', 'Museum ticket & shoe-keeping fee.', 23.6435, 90.5978, 'destination'),
  (6, '01:45 PM', '1h 15m', 'দুপুরের খাবার ও নামাজ বিরতি', 'Lunch & Prayer Break', 'মোগড়াপাড়া / স্থানীয় হোটেল', 'Mograpara Local Restaurant', 'দুপুরের ভাত-মাছ/মুরগি বা খিচুড়ি, সাথে পানি ও কোল্ড ড্রিংকস।', 'Hearty local lunch together + Zuhr prayer & short rest.', 'হাঁটা / অটো', 'Walk / Auto', 220, 'ব্যক্তিগত অর্ডার অনুযায়ী আলাদা খরচ হিসাব হবে।', 'Individual orders tracked cleanly in expense allocator.', 23.6370, 90.6042, 'food'),
  (7, '03:15 PM', '1h 30m', 'সোনারগাঁও থেকে পুরান ঢাকা', 'Sonargaon to Puran Dhaka', 'সোনারগাঁও → লালবাগ / গুলিস্তান', 'Sonargaon → Lalbagh / Gulistan', 'বিকেলের আলোয় পুরান ঢাকার উদ্দেশ্যে ফিরতি বাস যাত্রা।', 'Afternoon bus back toward Old Dhaka.', 'বাস + রিকশা', 'Bus + Rickshaw', 90, 'গুলিস্তান থেকে রিকশায় লালবাগ/চকবাজার।', 'Rickshaw ride from Gulistan into Old Dhaka lanes.', 23.7196, 90.3881, 'transit'),
  (8, '05:00 PM', '2h 30m', 'পুরান ঢাকা সন্ধ্যার আড্ডা ও খাবার', 'Puran Dhaka Evening Food & Heritage', 'লালবাগ, চকবাজার ও নাজিরাবাজার', 'Lalbagh, Chawkbazar & Nazirabazar', 'সন্ধ্যায় পুরান ঢাকার অলিগলি ঘোরা, লাচ্ছি/বোরহানি ও বিখ্যাত কাচ্চি/বিরিয়ানি ডিনার।', 'Evening stroll through Old Dhaka lanes, lassi/borhani & iconic biriyani dinner.', 'পায়ে হাঁটা / রিকশা', 'Walk / Rickshaw', 330, 'নাজিরাবাজার/আহসান মঞ্জিল পাড় হয়ে ডিনার — প্রতিজনের অর্ডার আলাদা লেখা হবে।', 'Dinner orders logged per person in Custom Allocation mode.', 23.7165, 90.4018, 'food'),
  (9, '07:45 PM', '1h 30m', 'সাভার প্রত্যাবর্তন', 'Return Journey to Savar', 'গুলিস্তান/গাবতলী → সিঅ্যান্ডবি, সাভার', 'Gulistan/Gabtoli → C&B, Savar', 'সফল ট্যুর শেষে নিরাপদে সাভারে ফিরে আসা ও চূড়ান্ত ক্যাশ হিসাব মেলানো।', 'Safe ride home to Savar & final cash settlement.', 'বাস', 'Bus', 80, 'দিন শেষে বাকি টাকা ফেরত বা সমন্বয়।', 'Final cash balance reconciliation after arrival.', 23.8482, 90.2644, 'return')
ON CONFLICT DO NOTHING;

-- Seed Initial Checklist
INSERT INTO public.checklist_items (scope, title_bn, title_en, is_completed, due_label)
VALUES
  ('group', 'সবাই নগদ ৳১,০০০ ক্যাশ শাহরিয়ারের কাছে জমা দেওয়া', 'Submit ৳1,000 cash contribution to Shahriar', FALSE, '27 Nov'),
  ('group', 'পাওয়ার ব্যাংক ও মাল্টি-প্লাগ সাথে নেওয়া', 'Bring 20,000mAh power banks & cables', FALSE, '28 Nov 6:00 AM'),
  ('group', 'প্রাথমিক চিকিৎসার ছোট ফার্স্ট-এইড কিট ও স্যালাইন', 'Pack basic first-aid kit & ORS saline', FALSE, '27 Nov'),
  ('group', 'স্টুডেন্ট আইডি কার্ড সাথে রাখা (জাদুঘর ছাড়ের জন্য)', 'Carry physical DIU student ID cards (for museum discount)', FALSE, '28 Nov'),
  ('personal', 'আরামদায়ক জুতা ও হালকা জ্যাকেট/হুডি (সন্ধ্যার জন্য)', 'Comfortable walking shoes & light jacket for evening', FALSE, '28 Nov'),
  ('personal', 'পানির বোতল, টিস্যু ও সানগ্লাস', 'Water bottle, tissues & sunglasses', FALSE, '28 Nov');

-- Seed Initial Poll
WITH new_poll AS (
  INSERT INTO public.polls (question_bn, question_en, description_bn, description_en, deadline, created_by)
  SELECT
    'পুরান ঢাকায় সন্ধ্যার ডিনার কোথায় হবে?',
    'Where should we have our Puran Dhaka evening dinner?',
    'সবার ভোটে ফাইনাল স্পট ঠিক করা হবে।',
    'Majority vote decides our evening biriyani spot.',
    '2026-11-27T22:00:00+06:00',
    id
  FROM public.members WHERE slug = 'shahriar'
  LIMIT 1
  RETURNING id
)
INSERT INTO public.poll_options (poll_id, label_bn, label_en, sort_order)
SELECT id, opt_bn, opt_en, ord
FROM new_poll,
(VALUES
  ('নাজিরাবাজার হাজী/হানিফ বিরিয়ানি + বিউটি লাচ্ছি', 'Nazirabazar Haji/Hanif Biriyani + Beauty Lassi', 1),
  ('স্টার কাবাব, ঠাঁটারীবাজার', 'Star Kabab, Thatari Bazar', 2),
  ('নান্না বিরিয়ানি, বেচারাম দেউড়ি', 'Nanna Biriyani, Becharam Dewri', 3)
) AS opts(opt_bn, opt_en, ord);

-- Seed Initial Shared Note
INSERT INTO public.shared_notes (author_id, title, content, is_pinned)
SELECT id,
  'জরুরি নির্দেশনা / Important Reminder',
  'সবাই সকাল ৬:৩০-এর আগে সিঅ্যান্ডবি, সাভারে চলে আসবো। কেউ দেরি করলে চায়ের বিল তার! ক্যাশ টাকা খুচরা করে আনলে ভালো হয়।',
  TRUE
FROM public.members WHERE slug = 'shahriar' LIMIT 1;
