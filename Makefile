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

deploy-test:
	truffle deploy --network test

deploy-dev:
	truffle deploy --network development

deploy-local:
	truffle deploy --network local
