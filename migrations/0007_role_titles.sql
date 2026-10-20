UPDATE users SET title=CASE effective_role WHEN 'executive_chef' THEN 'Executive Chef' WHEN 'cuisine_head' THEN 'Cuisine Head' ELSE title END;
