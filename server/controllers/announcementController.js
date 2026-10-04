const AnnouncementModel = require('../models/announcementModel');

class AnnouncementController {
  // Public: active announcement only
  static async getActive(req, res) {
    try {
      const ann = await AnnouncementModel.getActive();
      res.json({ success: true, announcement: ann || null });
    } catch (err) {
      console.error('Announcement getActive error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch announcement' });
    }
  }

  // Admin: list all
  static async list(req, res) {
    try {
      const items = await AnnouncementModel.getAll();
      res.json({ success: true, data: items });
    } catch (err) {
      console.error('Announcement list error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
    }
  }

  // Admin: get by ID
  static async getById(req, res) {
    try {
      const item = await AnnouncementModel.getById(req.params.id);
      if (!item) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: item });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error fetching announcement' });
    }
  }

  // Admin: create
  static async create(req, res) {
    try {
      const { title, message, type, bg_color, text_color, emoji, cta_text, cta_url, is_active, show_once, start_date, end_date } = req.body;
      if (!title || !message) {
        return res.status(400).json({ success: false, message: 'Title and message are required' });
      }
      const id = await AnnouncementModel.create({ title, message, type, bg_color, text_color, emoji, cta_text, cta_url, is_active, show_once, start_date, end_date });
      res.json({ success: true, message: 'Announcement created', id });
    } catch (err) {
      console.error('Announcement create error:', err);
      res.status(500).json({ success: false, message: 'Failed to create announcement' });
    }
  }

  // Admin: update
  static async update(req, res) {
    try {
      const { title, message, type, bg_color, text_color, emoji, cta_text, cta_url, is_active, show_once, start_date, end_date } = req.body;
      if (!title || !message) {
        return res.status(400).json({ success: false, message: 'Title and message are required' });
      }
      await AnnouncementModel.update(req.params.id, { title, message, type, bg_color, text_color, emoji, cta_text, cta_url, is_active, show_once, start_date, end_date });
      res.json({ success: true, message: 'Announcement updated' });
    } catch (err) {
      console.error('Announcement update error:', err);
      res.status(500).json({ success: false, message: 'Failed to update announcement' });
    }
  }

  // Admin: toggle active
  static async toggleActive(req, res) {
    try {
      const newState = await AnnouncementModel.toggleActive(req.params.id);
      if (newState === null) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, is_active: newState, message: newState ? 'Announcement activated' : 'Announcement deactivated' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to toggle' });
    }
  }

  // Admin: delete
  static async delete(req, res) {
    try {
      await AnnouncementModel.delete(req.params.id);
      res.json({ success: true, message: 'Announcement deleted' });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Failed to delete announcement' });
    }
  }
}

module.exports = AnnouncementController;
