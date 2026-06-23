# הקמת אחסון תמונות ב-Supabase

יש לבצע את השלבים האלה **לפני** שמעלים את הקוד המעודכן, כדי שהעלאת תמונות תעבוד.

## שלב 1: יצירת Bucket

1. ב-Supabase Dashboard → תפריט הצד → **Storage**
2. **New bucket**
3. שם הבאקט: בדיוק **`product-images`** (אותיות קטנות, מקף, בלי רווחים)
4. מסמנים **Public bucket** ✅ (כדי שהתמונות יוצגו ישירות בלי צורך באימות)
5. **Save**

## שלב 2: הגדרת הרשאות גישה (Policies)

אחרי יצירת הבאקט, נכנסים אליו ולוחצים על **Policies** (או: **SQL Editor** ומריצים את הקוד הבא):

```sql
-- אפשר לכל אחד להעלות תמונות לבאקט הזה
create policy "allow public uploads to product-images"
on storage.objects for insert
with check (bucket_id = 'product-images');

-- אפשר לכל אחד לקרוא (להציג) תמונות מהבאקט הזה
create policy "allow public read from product-images"
on storage.objects for select
using (bucket_id = 'product-images');

-- אפשר לכל אחד למחוק/להחליף תמונות בבאקט הזה (כשמחליפים תמונה למוצר)
create policy "allow public delete from product-images"
on storage.objects for delete
using (bucket_id = 'product-images');
```

מריצים את שלוש הפקודות ב-**SQL Editor** של Supabase (לא בבאקט עצמו).

## למה זה פתוח לכולם?

בדיוק כמו שאר המערכת (anon key, PIN פשוט) — זו אפליקציה משפחתית פרטית, לא צריכה הרשאות מורכבות. כל מי שיש לו את הקישור לאתר יכול להעלות/לראות תמונות, אבל זה מקובל לאפליקציה כזו בהיקף הזה.

## איך לבדוק שזה הוקם נכון

ב-**Storage** → `product-images`, מנסים להעלות תמונה לבדיקה דרך ה-UI של Supabase עצמו. אם זה מצליח, האפליקציה תעבוד.
