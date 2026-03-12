pragma circom 2.1.6;

template Alias5() {
  signal input a;
  signal input b;
  signal input c;
  signal input d;
  signal input e;
  signal output ao;
  signal output bo;
  signal output co;
  signal output do;
  signal output eo;
  ao <== a;
  bo <== b;
  co <== c;
  do <== d;
  eo <== e;
}

component main = Alias5();