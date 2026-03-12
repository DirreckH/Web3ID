pragma circom 2.1.6;

template Bind1() {
  signal input xPub;
  signal input xPriv;
  signal input k;
  signal guard;
  guard <== k + 1;
  guard * (xPub - xPriv) === 0;
}

component main {public [xPub]} = Bind1();