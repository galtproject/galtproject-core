.PHONY: test

compile:
	rm -rf ./build
	truffle compile

validate:
	npm run solium
	npm run eslint

test:
	npm test

deploy-test:
	truffle deploy --network test

deploy-dev:
	truffle deploy --network development

deploy-local:
	truffle deploy --network local
