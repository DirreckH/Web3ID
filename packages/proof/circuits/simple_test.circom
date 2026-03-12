pragma circom 2.1.6;

template Simple() {
  signal input a;
  signal output b;
  b <== a + 1;
}

component main = Simple();