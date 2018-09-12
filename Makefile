.PHONY: test

compile:
	rm -rf ./build
	truffle compile
	node scripts/checkContractSize.js

validate:
	npm run solium
	npm run eslint

test:
	truffle compile
	node scripts/checkContractSize.js
	npm test

check-size:
	node scripts/checkContractSize.js

deploy-ganache:
	rm -rf build && truffle migrate --network ganache && ./node_modules/.bin/surge ./deployed $$DOMAIN && echo "CONTRACTS_CONFIG_URL=$$DOMAIN\ganache.json"
	
deploy-testnet57:
	rm -rf build && truffle migrate --network testnet57 && ./node_modules/.bin/surge ./deployed $$DOMAIN && echo "CONTRACTS_CONFIG_URL=$$DOMAIN\testnet57.json"
	
deploy-local:
	rm -rf build && truffle migrate --network local && ./node_modules/.bin/surge ./deployed $$DOMAIN && echo "CONTRACTS_CONFIG_URL=$$DOMAIN\local.json"
