-- ============================================
-- תיקון קטן: אם הרצתם את migration-workspaces-db.sql לפני העדכון הזה,
-- הערך של missing_items_phones נשמר כמערך ריק [] במקום אובייקט {}.
-- מריצים את זה פעם אחת כדי לתקן (לא פוגע בכלום אם המבנה כבר תקין).
-- ============================================
update app_settings
set value = '{}'::jsonb
where key = 'missing_items_phones'
  and jsonb_typeof(value) = 'array';
