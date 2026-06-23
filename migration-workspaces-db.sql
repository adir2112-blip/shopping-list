-- ============================================
-- מיגרציה 4: העברת המשפחות ל-Database + טבלת הגדרות
-- מריצים פעם אחת על מסד הנתונים הקיים - לא מוחק כלום
-- ============================================

-- טבלת המשפחות (workspaces) - מחליפה את הרשימה הקבועה בקוד
create table if not exists workspaces (
  id text primary key,
  name text not null,
  emoji text not null default '🛒',
  pin text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table workspaces enable row level security;
drop policy if exists "allow all workspaces" on workspaces;
create policy "allow all workspaces" on workspaces for all using (true) with check (true);

-- מילוי ראשוני: שלוש המשפחות הקיימות, עם הסיסמאות שכבר הוגדרו בקוד
insert into workspaces (id, name, emoji, pin, sort_order) values
  ('adir', 'אדיר ויקירה', '🏡', '3914', 0),
  ('gal', 'גל', '🌿', '4432', 1),
  ('chaya', 'חיה', '🌸', '0000', 2)
on conflict (id) do nothing;

-- טבלת הגדרות גלובליות (כרגע: מספרי טלפון לדיווח חוסרי מלאי)
create table if not exists app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

alter table app_settings enable row level security;
drop policy if exists "allow all app_settings" on app_settings;
create policy "allow all app_settings" on app_settings for all using (true) with check (true);

-- מילוי ראשוני: מבנה ריק (יתמלא לפי משפחה דרך לשונית הגדרות)
insert into app_settings (key, value) values ('missing_items_phones', '{}'::jsonb)
on conflict (key) do nothing;

-- מאפשרים Realtime על הטבלאות החדשות (מוגן מהרצה כפולה)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'workspaces'
  ) then
    alter publication supabase_realtime add table workspaces;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table app_settings;
  end if;
end $$;
