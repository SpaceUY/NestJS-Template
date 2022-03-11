import { registerTemplate } from 'src/template/core/template-base';

export enum Currency {
  USD = 'USD',
  UYU = 'UYU',
}

export default registerTemplate<{
  title: string;
  name: string;
  amount: number;
  currency: string;
}>('example');
