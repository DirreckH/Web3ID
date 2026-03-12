pragma circom 2.1.6;

template Bind2() {
  signal input xPub;
  signal input yPub;
  signal input xPriv;
  signal input yPriv;
  signal input k;
  signal guard;
  guard <== k + 1;
  guard * (xPub - xPriv) === 0;
  guard * (yPub - yPriv) === 0;
}

component main {public [xPub, yPub]} = Bind2();