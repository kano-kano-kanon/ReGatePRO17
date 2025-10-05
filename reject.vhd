
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use ieee.numeric_std.all;

-- 基本論理ゲート VHDL 実装
-- ANDゲート
entity AND_GATE is
	Port ( A : in STD_LOGIC;
		   B : in STD_LOGIC;
		   Y : out STD_LOGIC);
end AND_GATE;

architecture Behavioral of AND_GATE is
begin
	Y <= A and B;
end Behavioral;

-- ORゲート
entity OR_GATE is
	Port ( A : in STD_LOGIC;
		   B : in STD_LOGIC;
		   Y : out STD_LOGIC);
end OR_GATE;

architecture Behavioral of OR_GATE is
begin
	Y <= A or B;
end Behavioral;

-- NOTゲート
entity NOT_GATE is
	Port ( A : in STD_LOGIC;
		   Y : out STD_LOGIC);
end NOT_GATE;

architecture Behavioral of NOT_GATE is
begin
	Y <= not A;
end Behavioral;

-- NANDゲート
entity NAND_GATE is
	Port ( A : in STD_LOGIC;
		   B : in STD_LOGIC;
		   Y : out STD_LOGIC);
end NAND_GATE;

architecture Behavioral of NAND_GATE is
begin
	Y <= not (A and B);
end Behavioral;

-- NORゲート
entity NOR_GATE is
	Port ( A : in STD_LOGIC;
		   B : in STD_LOGIC;
		   Y : out STD_LOGIC);
end NOR_GATE;

architecture Behavioral of NOR_GATE is
begin
	Y <= not (A or B);
end Behavioral;

-- XORゲート
entity XOR_GATE is
	Port ( A : in STD_LOGIC;
		   B : in STD_LOGIC;
		   Y : out STD_LOGIC);
end XOR_GATE;

architecture Behavioral of XOR_GATE is
begin
	Y <= A xor B;
end Behavioral;

-- FA
entity FA is
	Port ( A : in STD_LOGIC;
		   B : in STD_LOGIC;
		   Cin : in STD_LOGIC;
		   Sum : out STD_LOGIC;
		   Cout : out STD_LOGIC
	);
end FA;
architecture Behavioral of FA is
begin
	sum <= A+B+Cin;
	Cout <= (A and B) or (B and Cin) or (A and Cin);
end Behavioral;

-- HA
entity HA is
	Port ( A : in STD_LOGIC;
		   B : in STD_LOGIC;
		   Sum : out STD_LOGIC;
		   Cout : out STD_LOGIC
	);
end HA;
architecture Behavioral of HA is
begin
	Sum <= A xor B;
	Cout <= A and B;
end Behavioral;

-- 1bit NAND Memory
entity s_nand_memory is
	Port ( A : in STD_LOGIC;
		   B : in STD_LOGIC;
		   C : in STD_LOGIC;
		   D : out STD_LOGIC);
end s_nand_memory;

architecture Behavioral of s_nand_memory is
begin
	D <= not (A and B and C);
end Behavioral;
