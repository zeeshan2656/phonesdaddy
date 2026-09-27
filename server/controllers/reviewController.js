const ReviewModel = require('../models/reviewModel');
const PhoneModel = require('../models/phoneModel');
const NewsModel = require('../models/newsModel');
const { cache } = require('../utils/cache');

class ReviewController {
  /**
   * Helper to resolve phone by ID or slug
   */
  static async resolvePhone(identifier) {
    if (!identifier) return null;
    if (/^\d+$/.test(identifier)) {
      const phone = await PhoneModel.getPhoneById(parseInt(identifier, 10));
      if (phone) return phone;
    }
    return await PhoneModel.getPhoneBySlug(identifier);
  }

  /**
   * Helper to resolve news article by ID or slug
   */
  static async resolveNews(identifier) {
    if (!identifier) return null;
    if (/^\d+$/.test(identifier)) {
      const article = await NewsModel.getById(parseInt(identifier, 10));
      if (article) return article;
    }
    return await NewsModel.getBySlug(identifier);
  }

  /**
   * Public: Get reviews & star rating summary for a phone
   */
  static async getPhoneReviews(req, res, next) {
    try {
      const { identifier } = req.params;
      const phone = await ReviewController.resolvePhone(identifier);

      if (!phone) {
        return res.status(404).json({ success: false, message: 'Phone not found' });
      }

      const reviews = await ReviewModel.getByEntity('phone', phone.id);
      const stats = await ReviewModel.getPhoneRatingStats(phone.id);

      return res.json({
        success: true,
        phone: { id: phone.id, name: phone.name, slug: phone.slug },
        stats,
        reviews
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public: Post a review with star rating for a phone
   */
  static async postPhoneReview(req, res, next) {
    try {
      const { identifier } = req.params;
      const phone = await ReviewController.resolvePhone(identifier);

      if (!phone) {
        return res.status(404).json({ success: false, message: 'Phone not found' });
      }

      const { user_name, user_email_phone, user_website, rating, message } = req.body;

      // Validation
      if (!user_name || user_name.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Please enter a valid name (at least 2 characters).' });
      }

      if (!user_email_phone || user_email_phone.trim().length < 3) {
        return res.status(400).json({ success: false, message: 'Please enter your email or phone number.' });
      }

      const parsedRating = parseInt(rating, 10);
      if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
        return res.status(400).json({ success: false, message: 'Please select a star rating between 1 and 5.' });
      }

      if (!message || message.trim().length < 3) {
        return res.status(400).json({ success: false, message: 'Please write your review message (at least 3 characters).' });
      }

      // Format website URL if provided
      let cleanWebsite = user_website ? user_website.trim() : null;
      if (cleanWebsite && !/^https?:\/\//i.test(cleanWebsite)) {
        cleanWebsite = 'https://' + cleanWebsite;
      }

      const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

      const reviewId = await ReviewModel.create({
        entity_type: 'phone',
        entity_id: phone.id,
        user_name,
        user_email_phone,
        user_website: cleanWebsite,
        rating: parsedRating,
        message,
        ip_address
      });

      const updatedStats = await ReviewModel.getPhoneRatingStats(phone.id);
      cache.invalidateTags(['reviews']);

      return res.status(201).json({
        success: true,
        message: 'Thank you! Your review has been published.',
        data: {
          id: reviewId,
          user_name: user_name.trim(),
          rating: parsedRating,
          message: message.trim(),
          user_website: cleanWebsite,
          created_at: new Date().toISOString()
        },
        stats: updatedStats
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public: Get comments for a blog/news post
   */
  static async getNewsComments(req, res, next) {
    try {
      const { identifier } = req.params;
      const article = await ReviewController.resolveNews(identifier);

      if (!article) {
        return res.status(404).json({ success: false, message: 'Article not found' });
      }

      const comments = await ReviewModel.getByEntity('news', article.id);

      return res.json({
        success: true,
        article: { id: article.id, title: article.title, slug: article.slug },
        count: comments.length,
        comments
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public: Post a comment for a blog/news post
   */
  static async postNewsComment(req, res, next) {
    try {
      const { identifier } = req.params;
      const article = await ReviewController.resolveNews(identifier);

      if (!article) {
        return res.status(404).json({ success: false, message: 'Article not found' });
      }

      const { user_name, user_email_phone, user_website, message } = req.body;

      // Validation
      if (!user_name || user_name.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Please enter a valid name (at least 2 characters).' });
      }

      if (!user_email_phone || user_email_phone.trim().length < 3) {
        return res.status(400).json({ success: false, message: 'Please enter your email or phone number.' });
      }

      if (!message || message.trim().length < 3) {
        return res.status(400).json({ success: false, message: 'Please enter your comment message.' });
      }

      let cleanWebsite = user_website ? user_website.trim() : null;
      if (cleanWebsite && !/^https?:\/\//i.test(cleanWebsite)) {
        cleanWebsite = 'https://' + cleanWebsite;
      }

      const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

      const commentId = await ReviewModel.create({
        entity_type: 'news',
        entity_id: article.id,
        user_name,
        user_email_phone,
        user_website: cleanWebsite,
        rating: null,
        message,
        ip_address
      });

      cache.invalidateTags(['reviews']);

      return res.status(201).json({
        success: true,
        message: 'Thank you! Your comment has been published.',
        data: {
          id: commentId,
          user_name: user_name.trim(),
          message: message.trim(),
          user_website: cleanWebsite,
          created_at: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: List reviews & comments with advanced filters
   */
  static async adminList(req, res, next) {
    try {
      const { type = 'all', status = 'all', rating = 'all', search = '', page = 1, limit = 25 } = req.query;

      const result = await ReviewModel.getAllAdmin({
        type,
        status,
        rating,
        search,
        page,
        limit
      });

      return res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Summary metrics for dashboard
   */
  static async adminStats(req, res, next) {
    try {
      const stats = await ReviewModel.getAdminStats();
      return res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Update status (Approve or Reject)
   */
  static async adminUpdateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be "approved" or "rejected"' });
      }

      const updated = await ReviewModel.updateStatus(id, status);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Review / Comment not found' });
      }

      cache.invalidateTags(['reviews']);

      return res.json({
        success: true,
        message: `Item has been ${status === 'approved' ? 'approved' : 'rejected'} successfully`
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Delete review or comment
   */
  static async adminDelete(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await ReviewModel.delete(id);

      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Review / Comment not found' });
      }

      cache.invalidateTags(['reviews']);

      return res.json({
        success: true,
        message: 'Review / Comment deleted successfully'
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public: Post a reply to an existing review or comment (User-to-User)
   */
  static async postPublicReply(req, res, next) {
    try {
      const { parentId } = req.params;
      const { user_name, user_email_phone, user_website, message } = req.body;

      // Validation
      if (!user_name || user_name.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Please enter a valid name (at least 2 characters).' });
      }

      if (!user_email_phone || user_email_phone.trim().length < 3) {
        return res.status(400).json({ success: false, message: 'Please enter your email or phone number.' });
      }

      if (!message || message.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Please write your reply message.' });
      }

      let cleanWebsite = user_website ? user_website.trim() : null;
      if (cleanWebsite && !/^https?:\/\//i.test(cleanWebsite)) {
        cleanWebsite = 'https://' + cleanWebsite;
      }

      const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

      const replyId = await ReviewModel.createReply({
        parent_id: parseInt(parentId, 10),
        user_name,
        user_email_phone,
        user_website: cleanWebsite,
        message,
        is_admin: false,
        ip_address
      });

      cache.invalidateTags(['reviews']);

      return res.status(201).json({
        success: true,
        message: 'Reply posted successfully!',
        data: {
          id: replyId,
          parent_id: parseInt(parentId, 10),
          user_name: user_name.trim(),
          message: message.trim(),
          user_website: cleanWebsite,
          is_admin: 0,
          created_at: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: View specific review/comment with complete reply thread
   */
  static async adminGetThread(req, res, next) {
    try {
      const { id } = req.params;
      const thread = await ReviewModel.getThreadById(id);

      if (!thread) {
        return res.status(404).json({ success: false, message: 'Review or comment not found' });
      }

      return res.json({
        success: true,
        data: thread
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Post official admin reply to any review or comment
   */
  static async adminPostReply(req, res, next) {
    try {
      const { id } = req.params;
      const { message } = req.body;

      if (!message || message.trim().length < 2) {
        return res.status(400).json({ success: false, message: 'Please enter reply message' });
      }

      const adminName = (req.session && req.session.admin && req.session.admin.name) || 'PhonesDaddy Support Team';
      const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

      const replyId = await ReviewModel.createReply({
        parent_id: parseInt(id, 10),
        user_name: adminName,
        user_email_phone: 'support@phonesdaddy.com',
        user_website: 'https://phonesdaddy.com',
        message: message.trim(),
        is_admin: true,
        ip_address
      });

      cache.invalidateTags(['reviews']);

      return res.status(201).json({
        success: true,
        message: 'Official reply posted successfully!',
        data: {
          id: replyId,
          parent_id: parseInt(id, 10),
          user_name: adminName,
          message: message.trim(),
          is_admin: 1,
          created_at: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Upload image for rich comments & reviews
   */
  static async uploadImage(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No image file uploaded' });
      }
      const imageUrl = `/uploads/reviews/${req.file.filename}`;
      return res.json({
        success: true,
        url: imageUrl,
        message: 'Image uploaded successfully'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ReviewController;

