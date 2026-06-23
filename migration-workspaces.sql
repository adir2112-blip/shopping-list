-- ============================================
-- מיגרציה: הוספת תמיכה ב-Workspaces (משפחות נפרדות)
-- מריצים את זה פעם אחת על מסד הנתונים הקיים - הוא לא מוחק כלום
-- ============================================

-- 1. הוספת עמודת workspace_id לכל הטבלאות
alter table categories add column if not exists workspace_id text not null default 'adir';
alter table products add column if not exists workspace_id text not null default 'adir';
alter table shopping_history add column if not exists workspace_id text not null default 'adir';

-- 2. כל הדאטה הקיים (הרשימה שכבר נטענה) משויך ל-workspace של אדיר ויקירה
update categories set workspace_id = 'adir' where workspace_id is null;
update products set workspace_id = 'adir' where workspace_id is null;
update shopping_history set workspace_id = 'adir' where workspace_id is null;

-- 3. הסרת ברירת המחדל (כדי שמעכשיו כל insert חדש יצטרך לקבוע workspace_id במפורש)
alter table categories alter column workspace_id drop default;
alter table products alter column workspace_id drop default;
alter table shopping_history alter column workspace_id drop default;

-- 4. אינדקסים לביצועים טובים יותר בסינון לפי workspace
create index if not exists idx_categories_workspace on categories(workspace_id);
create index if not exists idx_products_workspace on products(workspace_id);
create index if not exists idx_history_workspace on shopping_history(workspace_id);

-- הערה: ה-RLS policies הקיימות ("allow all") נשארות כפי שהן -
-- הסינון לפי workspace מתבצע בקוד האפליקציה (בכל שאילתה), לא ב-RLS,
-- כי זו הגנה משפחתית בסיסית ולא הפרדת אבטחה אמיתית בין דיירים.
