const tagModel = require('../models/tagModel');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

class TagController {
  
  // Create a single tag
  async createTag(req, res, next) {
    try {
      const { tag_uid, product_id, status } = req.body;

      validateRequiredFields(req.body, ['tag_uid']);

      const tagData = {
        tag_uid,
        product_id,
        status: status || 'available'
      };

      const tag = await tagModel.createTag(tagData);

      res.status(201).json(
        successResponse('NFC tag created successfully', { tag })
      );

    } catch (error) {
      next(error);
    }
  }

  // Create multiple tags in bulk
  async createBulkTags(req, res, next) {
    try {
      const { tag_uids } = req.body;

      validateRequiredFields(req.body, ['tag_uids']);

      if (!Array.isArray(tag_uids) || tag_uids.length === 0) {
        return res.status(400).json(
          errorResponse('tag_uids must be a non-empty array')
        );
      }

      const tags = await tagModel.createBulkTags(tag_uids);

      res.status(201).json(
        successResponse(`${tags.length} NFC tags created successfully`, { tags })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get all tags
  async getAllTags(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        status, 
        product_id,
        unassigned_only 
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        product_id,
        unassigned_only: unassigned_only === 'true'
      };

      const result = await tagModel.getAllTags(filters);

      res.json(
        successResponse('Tags retrieved successfully', result)
      );

    } catch (error) {
      next(error);
    }
  }

  // Get tag by UID
  async getTagByUid(req, res, next) {
    try {
      const { tag_uid } = req.params;

      const tag = await tagModel.getTagByUid(tag_uid);

      if (!tag) {
        return res.status(404).json(
          errorResponse('Tag not found')
        );
      }

      res.json(
        successResponse('Tag retrieved successfully', { tag })
      );

    } catch (error) {
      next(error);
    }
  }

  // Assign tag to product
  async assignTagToProduct(req, res, next) {
    try {
      const { tag_id } = req.params;
      const { product_id } = req.body;

      validateRequiredFields(req.body, ['product_id']);

      const updatedTag = await tagModel.assignTagToProduct(tag_id, product_id);

      res.json(
        successResponse('Tag assigned to product successfully', { tag: updatedTag })
      );

    } catch (error) {
      next(error);
    }
  }

  // Unassign tag from product
  async unassignTag(req, res, next) {
    try {
      const { tag_id } = req.params;

      const updatedTag = await tagModel.unassignTag(tag_id);

      res.json(
        successResponse('Tag unassigned successfully', { tag: updatedTag })
      );

    } catch (error) {
      next(error);
    }
  }

  // Scan tag (simulate NFC scan)
  async scanTag(req, res, next) {
    try {
      const { tag_uid } = req.params;

      const tag = await tagModel.scanTag(tag_uid);

      res.json(
        successResponse('Tag scanned successfully', { tag })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get available tags
  async getAvailableTags(req, res, next) {
    try {
      const availableTags = await tagModel.getAvailableTags();

      res.json(
        successResponse('Available tags retrieved successfully', { 
          tags: availableTags 
        })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get tags by product
  async getTagsByProduct(req, res, next) {
    try {
      const { product_id } = req.params;

      const tags = await tagModel.getTagsByProduct(product_id);

      res.json(
        successResponse('Product tags retrieved successfully', { tags })
      );

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TagController();