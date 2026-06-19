update tgd_user_profiles 
set auth_user_id = (select id from auth.users where email = 'thitiwat.tan@tgm.co.th'),
    role = 'admin',
    is_active = true
where email = 'thitiwat.tan@tgm.co.th';
