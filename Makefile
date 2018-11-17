.PHONY: test benchmark

cleanup:
	rm -rf ./build

compile: cleanup
	truffle compile
	node scripts/checkContractSize.js

validate:
	npm run solium
	npm run eslint

only-skip:
	./scripts/only-skip.sh

only-recover:
	./scripts/only-recover.sh

test: only-skip
	-npm test
	tput bel
	$(MAKE) only-recover

retest: cleanup test

check-size:
	node scripts/checkContractSize.js
	
benchmark:
	for file in `ls ./benchmark`; do echo \\n$${file}\\n; ./node_modules/.bin/truffle exec benchmark/$${file} --network test -c; done

deploy-ganache:
	rm -rf build && truffle migrate --network ganache && ./node_modules/.bin/surge ./deployed $$DOMAIN && echo "CONTRACTS_CONFIG_URL=$$DOMAIN\ganache.json"
	
deploy-testnet57:
	rm -rf build && truffle migrate --network testnet57 && ./node_modules/.bin/surge ./deployed $$DOMAIN && echo "CONTRACTS_CONFIG_URL=$$DOMAIN\testnet57.json"
	
deploy-local:
	rm -rf build && truffle migrate --network local && ./node_modules/.bin/surge ./deployed $$DOMAIN && echo "CONTRACTS_CONFIG_URL=$$DOMAIN\local.json"
