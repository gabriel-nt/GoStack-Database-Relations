import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrderRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomerRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Invalid customer');
    }

    const ids = products.map(product => ({
      id: product.id,
    }));

    const productsExist = await this.productsRepository.findAllById(ids);

    if (!productsExist.length) {
      throw new AppError(`The product non existing`);
    }

    const existentProductsId = productsExist.map(product => product.id);

    const inexistentProduct = products.filter(
      product => !existentProductsId.includes(product.id),
    );

    if (inexistentProduct.length) {
      throw new AppError(`The product ${inexistentProduct[0].id} non existing`);
    }

    const productsQuantity = products.filter(
      product =>
        productsExist.filter(item => product.id === item.id)[0].quantity <
        product.quantity,
    );

    if (productsQuantity.length) {
      throw new AppError(`The quantity ${productsQuantity[0].id}`);
    }

    const parsedProduct = products.map(product => {
      return {
        product_id: product.id,
        price: productsExist.filter(p => p.id === product.id)[0].price,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: parsedProduct,
    });

    const { order_products } = order;

    const updateQuantityProducts = order_products.map(product => {
      return {
        id: product.product_id,
        quantity:
          productsExist.filter(p => p.id === product.product_id)[0].quantity -
          product.quantity,
      };
    });

    await this.productsRepository.updateQuantity(updateQuantityProducts);

    return order;
  }
}

export default CreateOrderService;
