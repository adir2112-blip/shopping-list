-- ============================================
-- מערכת רשימת קניות - Schema for Supabase
-- ============================================

-- מחלקות (קטגוריות)
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  name text not null,
  emoji text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- מוצרים (המאגר הכללי - כל המוצרים שהוגדרו אי פעם)
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null default 0,
  quantity numeric(10,2) not null default 1,
  sort_order integer not null default 0,
  -- האם המוצר נמצא ברשימת הקניות הפעילה (true) או רק במאגר הכללי (false)
  in_active_list boolean not null default false,
  -- מצב במחזור הקניה הנוכחי: 'pending' | 'bought' | 'missing'
  status text not null default 'pending',
  -- קישור לתמונת המוצר ב-Supabase Storage (אופציונלי)
  image_url text,
  created_at timestamptz not null default now()
);

-- היסטוריית קניות שהסתיימו
create table if not exists shopping_history (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  finished_at timestamptz not null default now(),
  total numeric(10,2) not null default 0,
  -- snapshot מלא של מה שנקנה/נחסר באותה קניה (JSON)
  items jsonb not null default '[]'::jsonb
);

-- אינדקסים
create index if not exists idx_products_category on products(category_id);
create index if not exists idx_categories_sort on categories(sort_order);
create index if not exists idx_products_sort on products(sort_order);
create index if not exists idx_categories_workspace on categories(workspace_id);
create index if not exists idx_products_workspace on products(workspace_id);
create index if not exists idx_history_workspace on shopping_history(workspace_id);

-- ============================================
-- Row Level Security - גישה פתוחה לאפליקציה משפחתית
-- ============================================
alter table categories enable row level security;
alter table products enable row level security;
alter table shopping_history enable row level security;

create policy "allow all categories" on categories for all using (true) with check (true);
create policy "allow all products" on products for all using (true) with check (true);
create policy "allow all history" on shopping_history for all using (true) with check (true);

-- ============================================
-- אפשר Realtime על הטבלאות (לסנכרון בין מכשירים)
-- ============================================
alter publication supabase_realtime add table categories;
alter publication supabase_realtime add table products;
alter publication supabase_realtime add table shopping_history;
