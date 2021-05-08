import { useState, useContext, useEffect } from 'react';
import {useMutation, useQuery} from '@apollo/client';

import YourOrder from "./YourOrder";
import PaymentModes from "./PaymentModes";
import { AppContext } from "../context/AppContext";
import validateAndSanitizeCheckoutForm from '../../validator/checkout';
import { getFormattedCart, createCheckoutData } from "../../functions";
import OrderSuccess from "./OrderSuccess";
import GET_CART from "../../queries/get-cart";
import CHECKOUT_MUTATION from "../../mutations/checkout";
import Address from "./Address";
import {
	handleBillingDifferentThanShipping,
	handleBillingSameAsShipping,
	handleCreateAccount,
	setStatesForCountry
} from "../../utils/checkout";
import CheckboxField from "./form-elements/CheckboxField";

// Use this for testing purposes, so you dont have to fill the checkout form over an over again.
// const defaultCustomerInfo = {
// 	firstName: 'Imran',
// 	lastName: 'Sayed',
// 	address1: '123 Abc farm',
// 	address2: 'Hill Road',
// 	city: 'Mumbai',
// 	country: 'IN',
// 	state: 'Maharastra',
// 	postcode: '221029',
// 	email: 'codeytek.academy@gmail.com',
// 	phone: '9883778278',
// 	company: 'The Company',
// 	errors: null
// }

const defaultCustomerInfo = {
	firstName: '',
	lastName: '',
	address1: '',
	address2: '',
	city: '',
	country: '',
	state: '',
	postcode: '',
	email: '',
	phone: '',
	company: '',
	errors: null
}

const CheckoutForm = ({countriesData}) => {

	const {billingCountries, shippingCountries} = countriesData || {}

	const initialState = {
		billing: {
			...defaultCustomerInfo,
		},
		shipping: {
			...defaultCustomerInfo
		},
		createAccount: false,
		orderNotes: '',
		billingDifferentThanShipping: false,
		paymentMethod: '',
	};

	const [cart, setCart] = useContext(AppContext);
	const [input, setInput] = useState(initialState);
	const [orderData, setOrderData] = useState(null);
	const [requestError, setRequestError] = useState(null);
	const [theShippingStates, setTheShippingStates] = useState([]);
	const [isFetchingShippingStates, setIsFetchingShippingStates] = useState(false);
	const [theBillingStates, setTheBillingStates] = useState([]);
	const [isFetchingBillingStates, setIsFetchingBillingStates] = useState(false);

	// Get Cart Data.
	const { data, refetch } = useQuery( GET_CART, {
		notifyOnNetworkStatusChange: true,
		onCompleted: () => {
			// Update cart in the localStorage.
			const updatedCart = getFormattedCart( data );
			localStorage.setItem( 'woo-next-cart', JSON.stringify( updatedCart ) );

			// Update cart data in React Context.
			setCart( updatedCart );
		}
	} );

	// Checkout or CreateOrder Mutation.
	const [ checkout, { data: checkoutResponse, loading: checkoutLoading, error: checkoutError } ] = useMutation( CHECKOUT_MUTATION, {
		variables: {
			input: orderData
		},
		onCompleted: () => {
			// console.warn( 'completed CHECKOUT_MUTATION' );
			refetch();
		},
		onError: ( error ) => {
			if ( error ) {
				setRequestError( error.graphQLErrors[ 0 ].message );
			}
		}
	} );

	/*
	 * Handle form submit.
	 *
	 * @param {Object} event Event Object.
	 *
	 * @return {void}
	 */
	const handleFormSubmit = ( event ) => {
		event.preventDefault();

		// Validate Billing and Shipping Details
		const billingValidationResult = validateAndSanitizeCheckoutForm( input?.billing );
		const shippingValidationResult = validateAndSanitizeCheckoutForm( input?.shipping );

		if ( ! shippingValidationResult.isValid || !billingValidationResult.isValid ) {
			setInput({
				...input,
				billing: {...input.billing, errors: billingValidationResult.errors},
				shipping: {...input.shipping, errors: shippingValidationResult.errors}
			});

			return;
		}

		const checkOutData = createCheckoutData( input );
		setOrderData( checkOutData );
		setRequestError( null );
	};

	/*
	 * Handle onchange input.
	 *
	 * @param {Object} event Event Object.
	 * @param {bool} isShipping If this is false it means it is billing.
	 * @param {bool} isBillingOrShipping If this is false means its standard input and not billing or shipping.
	 *
	 * @return {void}
	 */
	const handleOnChange = async ( event, isShipping = false, isBillingOrShipping = false ) => {

		const {target}= event || {};

		if ( 'createAccount' === target.name ) {
			handleCreateAccount( input, setInput, target )
		} else if('billingDifferentThanShipping' === target.name) {
			handleBillingDifferentThanShipping( input, setInput, target );
		} else if (isBillingOrShipping) {
			if ( isShipping ) {
				await handleShippingChange( target )
			} else {
				await handleBillingChange( target )
			}
		} else {
			const newState = { ...input, [target.name]: target.value };
			setInput( newState );
		}
	};

	const handleShippingChange = async (target) => {
		const newState = { ...input, shipping: { ...input?.shipping, [target.name]: target.value } };
		setInput( newState );
		await setStatesForCountry( target, setTheShippingStates, setIsFetchingShippingStates );
	}

	const handleBillingChange = async (target) => {
		const newState = { ...input, billing: { ...input?.billing, [target.name]: target.value } };
		setInput( newState );
		await setStatesForCountry( target, setTheBillingStates, setIsFetchingBillingStates );
	}

	useEffect( async () => {

		if ( null !== orderData ) {
			// Call the checkout mutation when the value for orderData changes/updates.
			await checkout();
		}

	}, [ orderData ] );

	console.log( 'input', input );

	return (
		<>
			{ cart ? (
				<form onSubmit={ handleFormSubmit } className="woo-next-checkout-form">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-20">
						<div>
							{/*Shipping Details*/}
							<div className="billing-details">
								<h2 className="text-xl font-medium mb-4">Shipping Details</h2>
								<Address
									states={theShippingStates}
									countries={shippingCountries}
									input={ input?.shipping }
									handleOnChange={ (event) => handleOnChange(event, true) }
									isFetchingStates={isFetchingShippingStates}
									isShipping
									isBillingOrShipping
								/>
							</div>
							<div>
							<CheckboxField
								name="billingDifferentThanShipping"
								type="checkbox"
								checked={input?.billingDifferentThanShipping}
								handleOnChange={handleOnChange}
								label="Billing different than shipping"
								containerClassNames="mb-4 pt-4"
							/>
							</div>
							{/*Billing Details*/}
							{ input?.billingDifferentThanShipping ? (
								<div className="billing-details">
									<h2 className="text-xl font-medium mb-4">Billing Details</h2>
									<Address
										states={theBillingStates}
										countries={billingCountries}
										input={ input?.billing }
										handleOnChange={ (event) => handleOnChange(event, false) }
										isFetchingStates={isFetchingBillingStates}
										isShipping={false}
										isBillingOrShipping
									/>
								</div>
							) : null }

						</div>
						{/* Order & Payments*/}
						<div className="your-orders">
							{/*	Order*/}
							<h2 className="text-xl font-medium mb-4">Your Order</h2>
							<YourOrder cart={ cart }/>

							{/*Payment*/}
							<PaymentModes input={ input } handleOnChange={ handleOnChange }/>
							<div className="woo-next-place-order-btn-wrap mt-5">
								<button className="bg-purple-600 text-white px-5 py-3 rounded-sm w-auto xl:w-full" type="submit">
									Place Order
								</button>
							</div>

							{/* Checkout Loading*/}
							{checkoutLoading && <p>Processing Order...</p>}
							{requestError && <p>Error : { requestError } :( Please try again</p>}
						</div>
					</div>
				</form>
			) : '' }

		{/*	Show message if Order Sucess*/}
		<OrderSuccess response={ checkoutResponse }/>
		</>
	);
};

export default CheckoutForm;
