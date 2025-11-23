const productModel = require('../models/productModel');
const { successResponse, errorResponse, validateRequiredFields } = require('../utils/helpers');

class ProductController {
  
  // Create new product
  async createProduct(req, res, next) {
    try {
      const { 
        name, 
        description, 
        price, 
        sku, 
        category, 
        image_url, 
        stock_quantity, 
        low_stock_threshold 
      } = req.body;

      // Validate required fields
      validateRequiredFields(req.body, ['name', 'price']);

      // Validate price
      if (price < 0) {
        return res.status(400).json(
          errorResponse('Price cannot be negative')
        );
      }

      // Validate stock quantity
      if (stock_quantity && stock_quantity < 0) {
        return res.status(400).json(
          errorResponse('Stock quantity cannot be negative')
        );
      }

      const productData = {
        name,
        description,
        price: parseFloat(price),
        sku,
        category,
        image_url,
        stock_quantity: stock_quantity ? parseInt(stock_quantity) : 0,
        low_stock_threshold: low_stock_threshold ? parseInt(low_stock_threshold) : 5
      };

      const product = await productModel.createProduct(productData);

      res.status(201).json(
        successResponse('Product created successfully', { product })
      );

    } catch (error) {
      next(error);
    }
  }

  // Get all products
  async getAllProducts(req, res, next) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        category, 
        search, 
        in_stock_only 
      } = req.query;

      const filters = {
        page: parseInt(page),
        limit: parseInt(limit),
        category,
        search,
        in_stock_only: in_stock_only === 'true'
      };

      const result = await productModel.getAllProducts(filters);

      res.json(
        successResponse('Products retrieved successfully', result)
      );

    } catch (error) {
      next(error);
    }
  }

  // Get product by ID
  async getProductById(req, res, next) {
    try {
      const { id } = req.params;

      const product = await productModel.getProductById(id);

      if (!product) {
        return res.status(404).json(
          errorResponse('Product not found')
        );
      }

      res.json(
        successResponse('Product retrieved successfully', { product })
      );

    } catch (error) {
      next(error);
    }
  }

  // Update product
  async updateProduct(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Check if product exists
      const existingProduct = await productModel.getProductById(id);
      if (!existingProduct) {
        return res.status(404).json(
          errorResponse('Product not found')
        );
      }

      // Validate price if provided
      if (updateData.price !== undefined && updateData.price < 0) {
        return res.status(400).json(
          errorResponse('Price cannot be negative')
        );
      }

      const updatedProduct = await productModel.updateProduct(id, updateData);

      res.json(
        successResponse('Product updated successfully', { product: updatedProduct })
      );

    } catch (error) {
      next(error);
    }
  }

  // Delete product
  async deleteProduct(req, res, next) {
    try {
      const { id } = req.params;

      // Check if product exists
      const existingProduct = await productModel.getProductById(id);
      if (!existingProduct) {
        return res.status(404).json(
          errorResponse('Product not found')
        );
      }

      await productModel.deleteProduct(id);

      res.json(
        successResponse('Product deleted successfully')
      );

    } catch (error) {
      next(error);
    }
  }

  // Get low stock products
  async getLowStockProducts(req, res, next) {
    try {
      const lowStockProducts = await productModel.getLowStockProducts();

      res.json(
        successResponse('Low stock products retrieved successfully', { 
          products: lowStockProducts 
        })
      );

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();