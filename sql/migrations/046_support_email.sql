-- Business contact email: the new domain mailbox replaces the Gmail address (owner, 20 Nov 2026).
-- Used on invoices, policies, the contact page and as reply-to on customer emails.
UPDATE settings
SET value = JSON_SET(value, '$.email', 'support@swadeshimahadevproducts.com')
WHERE `key` = 'business' AND JSON_UNQUOTE(JSON_EXTRACT(value, '$.email')) = 'info.mahadevproducts@gmail.com';
