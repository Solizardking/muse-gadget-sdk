# Host build for the Solana Gadget Kit examples. No ESP-IDF, display, or secrets.
CC ?= clang
SAN ?= -fsanitize=address,undefined
CFLAGS ?= -std=c11 -Wall -Wextra -Werror $(SAN) -fno-omit-frame-pointer -g -O1
NACL_CFLAGS ?= -std=c11 -w -fsanitize=address -fno-omit-frame-pointer -g -O1
CPPFLAGS ?= -Iinclude -Isrc -I../pocket-wallet/firmware/components/pocket_wallet

LIB_OBJS = \
	build/solana_confirm.o \
	build/gadget_wallet.o \
	build/lcd_review.o \
	build/robotics_gate.o \
	build/pocket_phone.o \
	build/sha256.o \
	build/portfolio_preview.o \
	build/pocket_wallet.o \
	build/tweetnacl.o

EXAMPLES = \
	build/hardware_wallet \
	build/robotics_gate \
	build/solana_os_check \
	build/portfolio_preview \
	build/lcd_status

.PHONY: all test examples pocket-firmware clean

all: test examples

test: build/host_test
	./build/host_test

examples: $(EXAMPLES)

pocket-firmware: build/pocket_state_test build/pocket_meta_test
	./build/pocket_state_test
	./build/pocket_meta_test

build/host_test: tests/host_test.c $(LIB_OBJS)
	$(CC) $(CFLAGS) $(CPPFLAGS) -o $@ tests/host_test.c $(LIB_OBJS)

build/hardware_wallet: examples/hardware_wallet.c $(LIB_OBJS)
	$(CC) $(CFLAGS) $(CPPFLAGS) -o $@ examples/hardware_wallet.c $(LIB_OBJS)

build/robotics_gate: examples/robotics_gate.c $(LIB_OBJS)
	$(CC) $(CFLAGS) $(CPPFLAGS) -o $@ examples/robotics_gate.c $(LIB_OBJS)

build/solana_os_check: examples/solana_os_check.c $(LIB_OBJS)
	$(CC) $(CFLAGS) $(CPPFLAGS) -o $@ examples/solana_os_check.c $(LIB_OBJS)

build/portfolio_preview: examples/portfolio_preview.c $(LIB_OBJS)
	$(CC) $(CFLAGS) $(CPPFLAGS) -o $@ examples/portfolio_preview.c $(LIB_OBJS)

build/lcd_status: examples/lcd_status.c $(LIB_OBJS)
	$(CC) $(CFLAGS) $(CPPFLAGS) -o $@ examples/lcd_status.c $(LIB_OBJS)

build/pocket_state_test: ../pocket-wallet/firmware/tests/state_test.c ../pocket-wallet/firmware/components/pocket_wallet/pocket_wallet.c
	@mkdir -p build
	$(CC) $(CFLAGS) -I../pocket-wallet/firmware/components/pocket_wallet -o $@ \
		../pocket-wallet/firmware/tests/state_test.c \
		../pocket-wallet/firmware/components/pocket_wallet/pocket_wallet.c

build/pocket_meta_test: ../pocket-wallet/firmware/tests/meta_test.c ../pocket-wallet/firmware/components/pocket_wallet/pocket_meta.c
	@mkdir -p build
	$(CC) $(CFLAGS) -I../pocket-wallet/firmware/components/pocket_wallet -o $@ \
		../pocket-wallet/firmware/tests/meta_test.c \
		../pocket-wallet/firmware/components/pocket_wallet/pocket_meta.c

build/tweetnacl.o: src/tweetnacl.c src/tweetnacl.h
	@mkdir -p build
	$(CC) $(NACL_CFLAGS) -Isrc -c -o $@ src/tweetnacl.c

build/pocket_wallet.o: ../pocket-wallet/firmware/components/pocket_wallet/pocket_wallet.c
	@mkdir -p build
	$(CC) $(CFLAGS) $(CPPFLAGS) -c -o $@ $<

build/%.o: src/%.c
	@mkdir -p build
	$(CC) $(CFLAGS) $(CPPFLAGS) -c -o $@ $<

clean:
	rm -rf build
