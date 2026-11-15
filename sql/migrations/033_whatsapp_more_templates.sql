-- New WhatsApp automations: unpaid online order nudge, out for delivery, failed delivery attempt (NDR).
INSERT IGNORE INTO whatsapp_templates (template) VALUES ('payment_pending'), ('out_for_delivery'), ('delivery_failed');
