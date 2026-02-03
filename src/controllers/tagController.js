const tagModel = require('../models/tagModel');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

class TagController {
  
  // Create UHF RFID tag
  async createUHF(req, res, next) {
    try {
      const { uhf_uid, product_id, qr_code_data, status } = req.body;

      validateRequiredFields(req.body, ['uhf_uid']);

      const tagData = {
        uhf_uid,
        product_id,
        qr_code_data,
        status: status || 'available'
      };

      const tag = await tagModel.createUHF(tagData);

      res.status(201).json(
        successResponse('UHF RFID tag created successfully', { tag })
      );

    } catch (error) {
      next(error);
    }
  }

  // Create multiple UHF tags in bulk
  async createBulkUHFTags(req, res, next) {
    try {
      const { uhf_uids } = req.body;

      validateRequiredFields(req.body, ['uhf_uids']);

      if (!Array.isArray(uhf_uids) || uhf_uids.length === 0) {
        return res.status(400).json(
          errorResponse('uhf_uids must be a non-empty array')
        );
      }

      const tags = await tagModel.createBulkUHFTags(uhf_uids);

      res.status(201).json(
        successResponse(`${tags.length} UHF RFID tags created successfully`, { tags })
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

  // Get tag by UHF UID
  async getTagByUid(req, res, next) {
    try {
      const { uhf_uid } = req.params;

      const tag = await tagModel.getTagByUid(uhf_uid);

      if (!tag) {
        return res.status(404).json(
          errorResponse('UHF tag not found')
        );
      }

      res.json(
        successResponse('Tag retrieved successfully', { tag })
      );

    } catch (error) {
      next(error);
    }
  }

  // Assign UHF tag to product
  async assignTagToProduct(req, res, next) {
    try {
      const { uhf_uid } = req.params;
      const { product_id, qr_code_data } = req.body;

      validateRequiredFields(req.body, ['product_id']);

      const updatedTag = await tagModel.assignTagToProduct(uhf_uid, product_id, qr_code_data);

      res.json(
        successResponse('UHF tag assigned to product successfully', { tag: updatedTag })
      );

    } catch (error) {
      next(error);
    }
  }

  // Unassign tag from product
  async unassignTag(req, res, next) {
    try {
      const { uhf_uid } = req.params;

      const updatedTag = await tagModel.unassignTag(uhf_uid);

      res.json(
        successResponse('Tag unassigned successfully', { tag: updatedTag })
      );

    } catch (error) {
      next(error);
    }
  }

  // Scan tag (simulate UHF scan)
  async scanTag(req, res, next) {
    try {
      const { uhf_uid } = req.params;

      const tag = await tagModel.scanTag(uhf_uid);

      res.json(
        successResponse('UHF tag scanned successfully', { tag })
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
        successResponse('Available UHF tags retrieved successfully', { 
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

  // Get product by UHF tag
  async getProductByUHFTag(req, res, next) {
    try {
      const { uhf_uid } = req.params;

      const product = await tagModel.getProductByUHFTag(uhf_uid);

      if (!product) {
        return res.status(404).json(
          errorResponse('Product not found for this UHF tag')
        );
      }

      res.json(
        successResponse('Product retrieved successfully', { product })
      );

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TagController();