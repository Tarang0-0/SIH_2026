"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface CalendarDayProps {
  day: number | string;
  isHeader?: boolean;
  isSelected?: boolean;
  isAvailable?: boolean;
  isToday?: boolean;
  onClick?: () => void;
}

const CalendarDay: React.FC<CalendarDayProps> = ({
  day,
  isHeader,
  isSelected,
  isAvailable,
  isToday,
  onClick,
}) => {
  let dayClass = "text-slate-500 dark:text-slate-400";

  if (!isHeader) {
    if (isSelected) {
      dayClass = "bg-sky-600 dark:bg-sky-500 text-white shadow-sm font-bold scale-105";
    } else if (isToday) {
      dayClass = "border border-sky-400 dark:border-sky-500 text-sky-700 dark:text-sky-300 font-bold bg-sky-50 dark:bg-sky-950/40";
    } else if (isAvailable) {
      dayClass = "text-slate-900 dark:text-slate-100 font-semibold hover:bg-sky-100 dark:hover:bg-sky-900/50 cursor-pointer";
    } else {
      dayClass = "text-slate-400 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/40";
    }
  }

  return (
    <button
      type="button"
      disabled={isHeader}
      onClick={!isHeader && onClick ? onClick : undefined}
      aria-label={isHeader ? undefined : `Day ${day}`}
      className={`col-span-1 row-span-1 flex h-8 w-8 items-center justify-center transition-all ${
        isHeader ? "cursor-default text-slate-500 dark:text-slate-400" : "rounded-xl"
      } ${dayClass}`}
    >
      <span className={`font-medium ${isHeader ? "text-xs" : "text-sm"}`}>
        {day}
      </span>
    </button>
  );
};

export interface CalendarProps {
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  availableDates?: string[];
  title?: string;
  description?: string;
  actionLabel?: string;
  onActionClick?: () => void;
  className?: string;
  linkTo?: string;
}

export function Calendar({
  selectedDate,
  onSelectDate,
  availableDates = [],
  title = "Select Journey Date",
  description = "Choose a travel date to inspect live telemetric status or historical station arrival runs.",
  actionLabel = "Confirm Date",
  onActionClick,
  className = "",
  linkTo,
}: CalendarProps) {
  const [internalDate, setInternalDate] = useState<Date>(() => {
    if (selectedDate && !Number.isNaN(new Date(selectedDate).getTime())) {
      return new Date(selectedDate);
    }
    return new Date();
  });

  const [activeSelected, setActiveSelected] = useState<string>(selectedDate || "");

  const currentDate = internalDate;
  const currentMonth = currentDate.toLocaleString("default", { month: "long" });
  const currentYear = currentDate.getFullYear();
  const firstDayOfMonth = new Date(currentYear, currentDate.getMonth(), 1);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = new Date(
    currentYear,
    currentDate.getMonth() + 1,
    0
  ).getDate();

  const handlePrevMonth = () => {
    setInternalDate(new Date(currentYear, currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setInternalDate(new Date(currentYear, currentDate.getMonth() + 1, 1));
  };

  const handleDaySelect = (dayNumber: number) => {
    const yyyy = currentYear;
    const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
    const dd = String(dayNumber).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    setActiveSelected(dateStr);
    if (onSelectDate) {
      onSelectDate(dateStr);
    }
  };

  const renderCalendarDays = () => {
    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === currentYear && today.getMonth() === currentDate.getMonth();

    const days: React.ReactNode[] = [
      ...dayNames.map((day) => (
        <CalendarDay key={`header-${day}`} day={day} isHeader />
      )),
      ...Array.from({ length: firstDayOfWeek }).map((_, i) => (
        <div
          key={`empty-start-${i}`}
          className="col-span-1 row-span-1 h-8 w-8"
        />
      )),
      ...Array.from({ length: daysInMonth }).map((_, i) => {
        const dayNumber = i + 1;
        const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
        const dd = String(dayNumber).padStart(2, "0");
        const dateStr = `${currentYear}-${mm}-${dd}`;
        const isSelected = activeSelected === dateStr;
        const isToday = isCurrentMonth && today.getDate() === dayNumber;
        const isAvailable = availableDates.length === 0 || availableDates.includes(dateStr);

        return (
          <CalendarDay
            key={`date-${dayNumber}`}
            day={dayNumber}
            isSelected={isSelected}
            isToday={isToday}
            isAvailable={isAvailable}
            onClick={() => handleDaySelect(dayNumber)}
          />
        );
      }),
    ];

    return days;
  };

  return (
    <BentoCard height="h-auto" linkTo={linkTo} className={className}>
      <div className="grid h-full gap-5 lg:grid-cols-[1fr_auto] items-center">
        <div>
          <h2 className="mb-2 text-lg md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="mb-4 text-xs md:text-sm text-slate-600 dark:text-slate-300 max-w-md leading-relaxed">
            {description}
          </p>
          {activeSelected && (
            <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-sky-100 dark:bg-sky-950/80 border border-sky-300 dark:border-sky-800 text-xs font-mono font-bold text-sky-800 dark:text-sky-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Selected: {activeSelected}</span>
            </div>
          )}
          {onActionClick && (
            <div>
              <Button
                type="button"
                onClick={onActionClick}
                className="mt-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs"
              >
                {actionLabel}
              </Button>
            </div>
          )}
        </div>

        <div className="transition-all duration-500 ease-out">
          <div className="w-full sm:w-[350px] rounded-[24px] border border-sky-200 dark:border-sky-800/80 bg-white/90 dark:bg-[#07101e]/90 p-2 shadow-sm">
            <div
              className="rounded-2xl border border-sky-100 dark:border-sky-900/60 p-3"
              style={{ boxShadow: "0px 2px 1.5px 0px rgba(165,174,184,0.15) inset" }}
            >
              <div className="flex items-center justify-between px-1 mb-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="Previous Month"
                  className="p-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold"
                >
                  ←
                </button>
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {currentMonth}, {currentYear}
                  </p>
                  <span className="h-1 w-1 rounded-full bg-sky-500">&nbsp;</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">IST</p>
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Next Month"
                  className="p-1 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold"
                >
                  →
                </button>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1 px-1">
                {renderCalendarDays()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </BentoCard>
  );
}

export interface BentoCardProps {
  children: React.ReactNode;
  height?: string;
  rowSpan?: number;
  colSpan?: number;
  className?: string;
  showHoverGradient?: boolean;
  hideOverflow?: boolean;
  linkTo?: string;
}

export function BentoCard({
  children,
  height = "h-auto",
  rowSpan = 8,
  colSpan = 7,
  className = "",
  showHoverGradient = true,
  hideOverflow = true,
  linkTo,
}: BentoCardProps) {
  const cardContent = (
    <div
      className={`group relative flex flex-col rounded-2xl border border-sky-200/80 dark:border-sky-800/80 bg-white/95 dark:bg-[#0b1528]/95 p-6 hover:border-sky-400 dark:hover:border-sky-600 transition-all ${
        hideOverflow && "overflow-hidden"
      } ${height} row-span-${rowSpan} col-span-${colSpan} ${className}`}
    >
      {linkTo && (
        <div className="absolute bottom-4 right-6 z-[999] flex h-10 w-10 rotate-6 items-center justify-center rounded-full bg-sky-600 text-white opacity-0 transition-all duration-300 ease-in-out group-hover:translate-y-[-4px] group-hover:rotate-0 group-hover:opacity-100 shadow-md">
          <svg
            className="h-5 w-5"
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17.25 15.25V6.75H8.75"
            ></path>
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 7L6.75 17.25"
            ></path>
          </svg>
        </div>
      )}
      {showHoverGradient && (
        <div className="user-select-none pointer-events-none absolute inset-0 z-30 bg-gradient-to-tl from-sky-400/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100"></div>
      )}
      {children}
    </div>
  );

  if (linkTo) {
    return linkTo.startsWith("/") ? (
      <Link href={linkTo} className="block">
        {cardContent}
      </Link>
    ) : (
      <a
        href={linkTo}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {cardContent}
      </a>
    );
  }

  return cardContent;
}
