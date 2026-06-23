-- ============================================
-- מיגרציה 2: כמות למוצר + מנגנון "מאגר כללי מול רשימה פעילה"
-- מריצים פעם אחת על מסד הנתונים הקיים - לא מוחק כלום
-- ============================================

-- 1. עמודת כמות (כמה יחידות לקנות, ברירת מחדל 1)
alter table products add column if not exists quantity numeric(10,2) not null default 1;

-- 2. עמודת "כלול ברשימת הקניות הקרובה" - ה-checkbox בעריכה
--    true = המוצר נמצא ברשימה הפעילה / מסומן לקניה הקרובה
--    false = המוצר רק במאגר הכללי, לא חלק מהקניה הקרובה
alter table products add column if not exists in_active_list boolean not null default false;

-- 3. כל הדאטה הקיים שכבר היה "ברשימה" (status != לא רלוונטי, כולם היו ברשימה הפעילה
--    לפני המיגרציה הזו) - מסמנים אותם כ-in_active_list = true כדי שלא יאבדו מהתצוגה
update products set in_active_list = true where in_active_list = false;
